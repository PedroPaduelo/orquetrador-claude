import { prisma } from '../../../lib/prisma.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { isStepError, getErrorMessage, decideOnError, FALLBACK_MESSAGE } from './step-error-handler.js'
import { runValidators } from '../validators/validator-runner.js'
import { webhooksService } from '../../webhooks/webhooks.service.js'
import type { ValidatorConfig } from '../validators/types.js'
import type { Prisma } from '@prisma/client'
import type { PausedExecutionInfo } from './execution-state.js'
import type { ExecutionContext, OrchestratorDeps } from './orchestrator-types.js'
import { executeStep } from './step-executor.js'
import { finalizeExecution } from './orchestrator-utils.js'

export async function resumeExecution(
  deps: OrchestratorDeps,
  context: ExecutionContext,
  userAnswer: string,
  pausedInfo: PausedExecutionInfo,
): Promise<void> {
  const { conversationId, steps, projectPath, attachments, userId } = context
  const executionId = pausedInfo.executionId

  if (deps.activeExecutions.get(conversationId)) {
    throw new Error('Execution already in progress for this conversation')
  }

  deps.activeExecutions.set(conversationId, true)

  await executionStateManager.resumeFromPaused(executionId)

  const stepIndex = pausedInfo.stepIndex
  const step = steps[stepIndex]
  if (!step) {
    await executionStateManager.markFailed(executionId, `Step index ${stepIndex} not found`)
    deps.activeExecutions.delete(conversationId)
    return
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      stepId: step.id,
      role: 'user',
      content: userAnswer,
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
    executionId, conversationId,
    messageId: userMessage.id,
    role: 'user',
    content: userAnswer,
    stepId: step.id, stepName: step.name,
    attachments: userMessage.attachments,
  })

  orchestratorEvents.emitExecutionResumed({
    executionId, conversationId,
    stepId: step.id, stepName: step.name,
    stepOrder: stepIndex + 1,
  })

  orchestratorEvents.emitStepStart({
    executionId, conversationId,
    stepId: step.id, stepName: step.name,
    stepOrder: stepIndex + 1, totalSteps: steps.length,
  })

  try {
    let result = await executeStep(
      deps, executionId, conversationId, step, userAnswer, projectPath, attachments, userId,
    )

    if (result.cancelled || !deps.activeExecutions.get(conversationId)) {
      orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
      await executionStateManager.markCancelled(executionId)
      deps.activeExecutions.delete(conversationId)
      return
    }

    // If it needs user input AGAIN, pause again
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
              stepOrder: stepIndex + 1,
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

      await executionStateManager.markPaused(executionId, stepIndex, step.id, result.resumeToken, askQuestion)
      orchestratorEvents.emitExecutionPaused({
        executionId, conversationId,
        stepId: step.id, stepName: step.name,
        stepOrder: stepIndex + 1,
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
    }

    // Save result
    if (result.content) {
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId, stepId: step.id, role: 'assistant',
          content: result.content,
          metadata: {
            actions: result.actions,
            sessionId: result.resumeToken,
            stepName: step.name,
            stepOrder: stepIndex + 1,
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
    }

    orchestratorEvents.emitStepComplete({
      executionId, conversationId,
      stepId: step.id, stepName: step.name,
      stepOrder: stepIndex + 1,
      content: result.content,
      sessionId: result.resumeToken || undefined,
      finished: false,
    })

    await executionStateManager.saveCheckpoint(executionId, stepIndex, result.content, result.content).catch(() => {})

    // For sequential workflows: continue to next steps
    const isSequentialWorkflow = steps.length > 1 && context.workflowId
    if (isSequentialWorkflow) {
      let currentInput = result.content
      let retryCounts: Record<string, number> = {}

      for (let i = stepIndex + 1; i < steps.length; i++) {
        if (!deps.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const nextStep = steps[i]
        await executionStateManager.updateStepIndex(executionId, i)

        orchestratorEvents.emitStepStart({
          executionId, conversationId,
          stepId: nextStep.id, stepName: nextStep.name,
          stepOrder: i + 1, totalSteps: steps.length,
        })

        let nextResult = await executeStep(
          deps, executionId, conversationId, nextStep, currentInput, projectPath, undefined, userId,
        )

        if (nextResult.cancelled || !deps.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          deps.activeExecutions.delete(conversationId)
          return
        }

        if (nextResult.needsUserInput) {
          let askQ: PausedExecutionInfo['askUserQuestion'] | undefined
          for (const action of nextResult.actions) {
            if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
              const inp = action.input as Record<string, unknown>
              const questions = inp.questions as Array<Record<string, unknown>> | undefined
              if (questions && questions.length > 0) {
                const q = questions[0]
                askQ = {
                  question: q.question as string,
                  options: (q.options as Array<{ label: string; description?: string }>) || undefined,
                }
              }
            }
          }

          if (nextResult.content) {
            const msg = await prisma.message.create({
              data: {
                conversationId, stepId: nextStep.id, role: 'assistant',
                content: nextResult.content,
                metadata: {
                  actions: nextResult.actions,
                  sessionId: nextResult.resumeToken,
                  stepName: nextStep.name,
                  stepOrder: i + 1,
                  needsUserInput: true,
                } as unknown as Prisma.InputJsonValue,
              },
            })
            orchestratorEvents.emitMessageSaved({
              executionId, conversationId,
              messageId: msg.id,
              role: 'assistant',
              content: nextResult.content,
              stepId: nextStep.id, stepName: nextStep.name,
            })
          }

          await executionStateManager.markPaused(executionId, i, nextStep.id, nextResult.resumeToken, askQ)
          orchestratorEvents.emitExecutionPaused({
            executionId, conversationId,
            stepId: nextStep.id, stepName: nextStep.name,
            stepOrder: i + 1,
            resumeToken: nextResult.resumeToken,
            askUserQuestion: askQ,
          })
          deps.activeExecutions.delete(conversationId)
          return
        }

        if (isStepError(nextResult)) {
          const decision = decideOnError(nextStep, nextResult)
          const errMsg = getErrorMessage(nextResult)
          console.warn(decision.logMessage)
          orchestratorEvents.emitStepError({
            executionId, conversationId,
            stepId: nextStep.id, stepName: nextStep.name,
            error: `[${decision.action}] ${errMsg}`,
          })
          if (decision.action === 'fail') {
            await executionStateManager.markFailed(executionId, errMsg)
            deps.activeExecutions.delete(conversationId)
            return
          }
          if (decision.action === 'fallback') {
            const fbResult = await executeStep(
              deps, executionId, conversationId, nextStep,
              FALLBACK_MESSAGE, projectPath, undefined, userId,
            )
            if (isStepError(fbResult)) {
              await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
              deps.activeExecutions.delete(conversationId)
              return
            }
            nextResult = fbResult
          }
          if (decision.skipStep) {
            continue
          }
        }

        // Run validators
        const validatorConfigs = (nextStep.validators || []) as unknown as ValidatorConfig[]
        if (validatorConfigs.length > 0) {
          const validation = await runValidators(validatorConfigs, nextResult.content, projectPath)
          if (!validation.allPassed) {
            const failedResult = validation.results.find(r => !r.valid)
            const feedback = failedResult?.feedback || failedResult?.details || failedResult?.message || 'Validation failed'
            orchestratorEvents.emitValidationFailed({
              executionId, conversationId,
              stepId: nextStep.id, stepName: nextStep.name,
              validatorType: failedResult?.type || 'unknown',
              feedback,
            })
            const currentRetry = (retryCounts[`validator_${nextStep.id}`] || 0) + 1
            const maxRetries = nextStep.maxRetries || 2
            if (currentRetry < maxRetries) {
              retryCounts[`validator_${nextStep.id}`] = currentRetry
              currentInput = `A validacao falhou: ${feedback}\n\nPor favor corrija e tente novamente. Output anterior:\n${nextResult.content}`
              i-- // retry same step
              continue
            }
            delete retryCounts[`validator_${nextStep.id}`]
          }
        }

        const msg = await prisma.message.create({
          data: {
            conversationId, stepId: nextStep.id, role: 'assistant',
            content: nextResult.content,
            metadata: {
              actions: nextResult.actions,
              sessionId: nextResult.resumeToken,
              stepName: nextStep.name,
              stepOrder: i + 1,
            } as unknown as Prisma.InputJsonValue,
          },
        })
        orchestratorEvents.emitMessageSaved({
          executionId, conversationId,
          messageId: msg.id,
          role: 'assistant',
          content: nextResult.content,
          stepId: nextStep.id, stepName: nextStep.name,
        })

        orchestratorEvents.emitStepComplete({
          executionId, conversationId,
          stepId: nextStep.id, stepName: nextStep.name,
          stepOrder: i + 1,
          content: nextResult.content,
          sessionId: nextResult.resumeToken || undefined,
          finished: i >= steps.length - 1,
        })

        await executionStateManager.saveCheckpoint(executionId, i, nextResult.content, nextResult.content).catch(() => {})
        currentInput = nextResult.content
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
