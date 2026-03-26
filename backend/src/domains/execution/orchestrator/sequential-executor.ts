import { prisma } from '../../../lib/prisma.js'
import { conditionsEvaluator, type StepConditions } from './conditions-evaluator.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { isStepError, getErrorMessage, decideOnError, FALLBACK_MESSAGE } from './step-error-handler.js'
import { runValidators } from '../validators/validator-runner.js'
import { validateStepOutput, buildSchemaRetryMessage } from './output-validator.js'
import { webhooksService } from '../../webhooks/webhooks.service.js'
import type { ValidatorConfig } from '../validators/types.js'
import type { Prisma } from '@prisma/client'
import type { PausedExecutionInfo } from './execution-state.js'
import type { ExecutionContext, OrchestratorDeps } from './orchestrator-types.js'
import { executeStep } from './step-executor.js'
import { finalizeExecution, evaluateSkipCondition, backoffDelay } from './orchestrator-utils.js'

export async function executeSequential(
  deps: OrchestratorDeps,
  context: ExecutionContext,
  userInput: string,
): Promise<void> {
  const { conversationId, steps, projectPath, attachments, userId } = context

  if (deps.activeExecutions.get(conversationId)) {
    throw new Error('Execution already in progress for this conversation')
  }

  deps.activeExecutions.set(conversationId, true)

  const startIndex = 0
  const executionState = await executionStateManager.create(conversationId, startIndex)
  const executionId = executionState.id

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      stepId: steps[startIndex]?.id,
      role: 'user',
      content: userInput,
      ...(attachments && attachments.length > 0 ? {
        attachments: {
          create: attachments.map(att => ({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size || 0,
            path: att.path,
            projectPath: att.projectPath,
            url: att.url,
          })),
        },
      } : {}),
    },
    include: { attachments: true },
  })

  orchestratorEvents.emitMessageSaved({
    executionId,
    conversationId,
    messageId: userMessage.id,
    role: 'user',
    content: userInput,
    stepId: steps[startIndex]?.id,
    stepName: steps[startIndex]?.name,
    attachments: userMessage.attachments,
  })

  let currentInput = userInput
  let retryCounts: Record<string, number> = {}

  try {
    let i = 0
    while (i < steps.length) {
      if (!deps.activeExecutions.get(conversationId)) {
        orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
        await executionStateManager.markCancelled(executionId)
        return
      }

      const step = steps[i]

      if (step.skipCondition) {
        const shouldSkip = evaluateSkipCondition(step.skipCondition, currentInput, i)
        if (shouldSkip) {
          await executionStateManager.logEvent(
            executionId, conversationId, 'step_skipped',
            { reason: 'skipCondition', condition: step.skipCondition },
            step.id, step.name,
          )
          orchestratorEvents.emitStepStream({
            executionId, conversationId, stepId: step.id,
            type: 'action',
            action: { type: 'system', content: `Step "${step.name}" pulado (condição: ${step.skipCondition})` },
          })
          i++
          continue
        }
      }

      await executionStateManager.updateStepIndex(executionId, i)

      await executionStateManager.logEvent(
        executionId, conversationId, 'step_start',
        { stepOrder: i + 1, totalSteps: steps.length },
        step.id, step.name,
      )

      orchestratorEvents.emitStepStart({
        executionId, conversationId,
        stepId: step.id, stepName: step.name,
        stepOrder: i + 1, totalSteps: steps.length,
      })

      let result = await executeStep(
        deps, executionId, conversationId, step, currentInput, projectPath,
        i === 0 ? attachments : undefined, userId,
      )

      if (result.cancelled || !deps.activeExecutions.get(conversationId)) {
        orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
        await executionStateManager.markCancelled(executionId)
        deps.activeExecutions.delete(conversationId)
        return
      }

      // PAUSE: when Claude needs user input
      if (result.needsUserInput) {
        let askQuestion: PausedExecutionInfo['askUserQuestion'] | undefined
        for (const action of result.actions) {
          if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
            const input = action.input as Record<string, unknown>
            const questions = input.questions as Array<Record<string, unknown>> | undefined
            if (questions && questions.length > 0) {
              const q = questions[0]
              askQuestion = {
                question: q.question as string,
                options: (q.options as Array<{ label: string; description?: string }>) || undefined,
              }
            }
          }
        }

        if (result.content) {
          const assistantMessage = await prisma.message.create({
            data: {
              conversationId, stepId: step.id, role: 'assistant',
              content: result.content,
              metadata: {
                actions: result.actions,
                sessionId: result.resumeToken,
                stepName: step.name,
                stepOrder: i + 1,
                needsUserInput: true,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          orchestratorEvents.emitMessageSaved({
            executionId, conversationId,
            messageId: assistantMessage.id,
            role: 'assistant',
            content: result.content,
            stepId: step.id, stepName: step.name,
            metadata: { sessionId: result.resumeToken, needsUserInput: true, actions: result.actions },
          })
        }

        await executionStateManager.markPaused(executionId, i, step.id, result.resumeToken, askQuestion)
        orchestratorEvents.emitExecutionPaused({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          stepOrder: i + 1,
          resumeToken: result.resumeToken,
          askUserQuestion: askQuestion,
        })
        deps.activeExecutions.delete(conversationId)
        return
      }

      if (isStepError(result)) {
        const decision = decideOnError(step, result)
        const errMsg = getErrorMessage(result)
        console.warn(decision.logMessage)

        orchestratorEvents.emitStepError({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          error: `[${decision.action}] ${errMsg}`,
        })

        if (decision.action === 'fail') {
          await executionStateManager.markFailed(executionId, errMsg)
          deps.activeExecutions.delete(conversationId)
          return
        }

        if (decision.action === 'fallback') {
          const fbResult = await executeStep(
            deps, executionId, conversationId, step,
            FALLBACK_MESSAGE, projectPath, undefined, userId,
          )
          if (isStepError(fbResult)) {
            await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
            deps.activeExecutions.delete(conversationId)
            return
          }
          result = fbResult
        }

        if (decision.skipStep) {
          await executionStateManager.logEvent(
            executionId, conversationId, 'step_skipped',
            { error: errMsg, handler: 'skip' }, step.id, step.name,
          )
          i++
          continue
        }
      }

      // Run outputSchema validation (Structured Outputs)
      const outputSchema = step.outputSchema as Record<string, unknown> | null
      if (outputSchema && Object.keys(outputSchema).length > 0 && result.content) {
        const schemaValidation = validateStepOutput(result.content, outputSchema)
        if (!schemaValidation.valid) {
          const feedback = schemaValidation.errors.join('; ')
          orchestratorEvents.emitValidationFailed({
            executionId, conversationId,
            stepId: step.id, stepName: step.name,
            validatorType: 'output_schema',
            feedback,
          })

          const retryKey = `outputSchema_${step.id}`
          const currentRetry = (retryCounts[retryKey] || 0) + 1
          const maxRetries = step.maxRetries || 2

          if (currentRetry < maxRetries) {
            retryCounts[retryKey] = currentRetry
            await backoffDelay(currentRetry)
            currentInput = buildSchemaRetryMessage(currentInput, schemaValidation.errors, outputSchema)

            orchestratorEvents.emitStepStream({
              executionId, conversationId, stepId: step.id,
              type: 'action',
              action: {
                type: 'system',
                content: `Output Schema validation failed (attempt ${currentRetry}/${maxRetries}): ${feedback}. Retrying...`,
              },
            })

            continue
          }

          // Max retries exhausted - clean up and proceed with warning
          delete retryCounts[retryKey]
          orchestratorEvents.emitStepStream({
            executionId, conversationId, stepId: step.id,
            type: 'action',
            action: {
              type: 'system',
              content: `Output Schema validation failed after ${maxRetries} attempts. Proceeding with unvalidated output.`,
            },
          })
        } else {
          // Clean up retry counter on success
          delete retryCounts[`outputSchema_${step.id}`]
        }
      }

      // Run validators
      const validatorConfigs = (step.validators || []) as unknown as ValidatorConfig[]
      if (validatorConfigs.length > 0) {
        const validation = await runValidators(validatorConfigs, result.content, projectPath)
        if (!validation.allPassed) {
          const failedResult = validation.results.find(r => !r.valid)
          const feedback = failedResult?.feedback || failedResult?.details || failedResult?.message || 'Validation failed'
          orchestratorEvents.emitValidationFailed({
            executionId, conversationId,
            stepId: step.id, stepName: step.name,
            validatorType: failedResult?.type || 'unknown',
            feedback,
          })
          const currentRetry = (retryCounts[`validator_${step.id}`] || 0) + 1
          const maxRetries = step.maxRetries || 2
          if (currentRetry < maxRetries) {
            retryCounts[`validator_${step.id}`] = currentRetry
            await backoffDelay(currentRetry)
            currentInput = `A validacao falhou: ${feedback}\n\nPor favor corrija e tente novamente. Output anterior:\n${result.content}`
            continue
          }
          delete retryCounts[`validator_${step.id}`]
        }
      }

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId, stepId: step.id, role: 'assistant',
          content: result.content,
          metadata: {
            actions: result.actions,
            sessionId: result.resumeToken,
            stepName: step.name,
            stepOrder: i + 1,
          } as unknown as Prisma.InputJsonValue,
        },
      })

      orchestratorEvents.emitMessageSaved({
        executionId, conversationId,
        messageId: assistantMessage.id,
        role: 'assistant',
        content: result.content,
        stepId: step.id, stepName: step.name,
        metadata: { sessionId: result.resumeToken, actions: result.actions },
      })

      await executionStateManager.saveCheckpoint(executionId, i, result.content, result.content).catch(() => {})

      const conditions = (step.conditions || { rules: [], default: 'continue' }) as unknown as StepConditions
      const conditionResult = conditionsEvaluator.evaluate(result.content, conditions)

      const nextStep = conditionsEvaluator.resolveNextStep(
        conditionResult.action,
        steps.map((s) => ({ id: s.id, name: s.name })),
        i,
      )

      if (nextStep.isRetry) {
        const currentRetry = (retryCounts[step.id] || 0) + 1
        const maxRetries = conditionResult.rule?.maxRetries || step.maxRetries || 3

        if (currentRetry >= maxRetries) {
          orchestratorEvents.emitStepComplete({
            executionId, conversationId,
            stepId: step.id, stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.resumeToken || undefined,
            finished: false,
          })
          delete retryCounts[step.id]
          i++
          currentInput = result.content
        } else {
          retryCounts[step.id] = currentRetry
          await executionStateManager.updateRetryCounts(executionId, retryCounts)
          const retryMessage = conditionsEvaluator.formatRetryMessage(
            conditionResult.rule?.retryMessage,
            result.content,
            conditionResult.rule!,
          )
          orchestratorEvents.emitConditionRetry({
            executionId, conversationId,
            stepId: step.id,
            retryCount: currentRetry,
            maxRetries,
            retryMessage,
          })
          await backoffDelay(currentRetry)
          currentInput = retryMessage
        }
      } else if (nextStep.isFinished) {
        orchestratorEvents.emitStepComplete({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          stepOrder: i + 1,
          content: result.content,
          sessionId: result.resumeToken || undefined,
          finished: true,
        })
        break
      } else {
        orchestratorEvents.emitStepComplete({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          stepOrder: i + 1,
          content: result.content,
          sessionId: result.resumeToken || undefined,
          finished: nextStep.nextIndex >= steps.length,
        })

        if (nextStep.nextIndex < i && conditionResult.matched && conditionResult.rule) {
          const jumpKey = `jump_${step.id}_to_${nextStep.nextIndex}`
          const currentRetry = (retryCounts[jumpKey] || 0) + 1
          const maxRetries = conditionResult.rule.maxRetries || 3

          if (currentRetry >= maxRetries) {
            delete retryCounts[jumpKey]
            i = i + 1
            currentInput = result.content
          } else {
            retryCounts[jumpKey] = currentRetry
            await executionStateManager.updateRetryCounts(executionId, retryCounts)
            const retryMessage = conditionsEvaluator.formatRetryMessage(
              conditionResult.rule.retryMessage,
              result.content,
              conditionResult.rule,
            )
            orchestratorEvents.emitConditionJump({
              executionId, conversationId,
              fromStepId: step.id,
              toStepId: steps[nextStep.nextIndex]?.id || 'end',
              toStepIndex: nextStep.nextIndex,
            })
            await backoffDelay(currentRetry)
            i = nextStep.nextIndex
            currentInput = retryMessage
          }
        } else {
          const keysToDelete = Object.keys(retryCounts).filter(k => k.startsWith(`jump_${step.id}`))
          keysToDelete.forEach(k => delete retryCounts[k])

          if (nextStep.nextIndex !== i + 1) {
            orchestratorEvents.emitConditionJump({
              executionId, conversationId,
              fromStepId: step.id,
              toStepId: steps[nextStep.nextIndex]?.id || 'end',
              toStepIndex: nextStep.nextIndex,
            })
          }

          i = nextStep.nextIndex
          currentInput = result.content
        }
      }
    }

    await executionStateManager.markCompleted(executionId)
    finalizeExecution(executionId, conversationId)
    orchestratorEvents.emitExecutionComplete({ executionId, conversationId, success: true })

    if (userId) {
      webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await executionStateManager.markFailed(executionId, errorMessage)
    finalizeExecution(executionId, conversationId)
    if (userId) {
      webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
    }
    throw error
  } finally {
    deps.activeExecutions.delete(conversationId)
  }
}
