import { prisma } from '../../../lib/prisma.js'
import { defaultEngine, type CliEngine } from '../engine/index.js'
import { sessionManager } from '../session/session-manager.js'
import { conditionsEvaluator, type StepConditions } from './conditions-evaluator.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { fileSyncService } from '../file-sync/file-sync-service.js'
import { ExecutionMonitor } from '../monitoring/execution-monitor.js'
import { buildSystemPrompt } from '../engine/base-system-prompt.js'
import { DAGExecutor, isDAGWorkflow } from './dag-executor.js'
import { runValidators } from '../validators/validator-runner.js'
import type { ValidatorConfig } from '../validators/types.js'
import { webhooksService } from '../../webhooks/webhooks.service.js'
import type { WorkflowStep } from '@prisma/client'

export interface MessageAttachment {
  id: string
  filename: string
  mimeType: string
  path: string
  projectPath: string
  url: string
  size?: number
}

export interface ExecutionContext {
  conversationId: string
  workflowId: string
  steps: WorkflowStep[]
  projectPath: string
  attachments?: MessageAttachment[]
  userId?: string
}

export class TaskOrchestrator {
  private activeExecutions = new Map<string, boolean>()
  private engine: CliEngine

  constructor(engine?: CliEngine) {
    this.engine = engine || defaultEngine
  }

  private isPromptTooLongError(error: string | undefined): boolean {
    if (!error) return false
    const lower = error.toLowerCase()
    return lower.includes('prompt is too long') || lower.includes('prompt_too_long')
  }

  async executeStep(
    executionId: string,
    conversationId: string,
    step: WorkflowStep,
    input: string,
    projectPath: string,
    attachments?: MessageAttachment[],
    userId?: string,
  ) {
    // Get session (resume token) for this step
    let resumeToken = await sessionManager.getSession(conversationId, step.id)

    const systemPrompt = buildSystemPrompt({
      stepSystemPrompt: step.systemPrompt,
      projectPath,
    })

    // Create monitor for this execution
    const monitor = new ExecutionMonitor(executionId, conversationId, step.id)
    if (userId) monitor.setUserId(userId)
    monitor.setInputMetadata({
      messageLength: input.length,
      systemPrompt,
      resumeToken,
      model: step.model || null,
      projectPath,
    })

    // Sync files (skills, agents, .mcp.json) for this step
    if (projectPath) {
      try {
        await fileSyncService.syncForStep(projectPath, step.id)
      } catch (syncError) {
        console.error(`[Orchestrator] File sync failed for step ${step.id}:`, syncError)
        // Continue execution even if sync fails - base MCP servers may still work
      }
    }

    const makeOnEvent = (mon: ExecutionMonitor) => (event: import('../engine/claude/stream-parser.js').StreamEvent) => {
      mon.onParsedEvent(event)
      if (event.type === 'content' && event.content) {
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'content',
          content: event.content,
        })
      } else if (event.type === 'action' && event.action) {
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: event.action,
        })
      } else if (event.type === 'metadata' && event.metadata?.mcp_servers) {
        // Emit MCP server status as a system action so the frontend can show it
        const failed = event.metadata.mcp_servers.filter(s => s.status !== 'connected')
        const connected = event.metadata.mcp_servers.filter(s => s.status === 'connected')
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: {
            type: 'system',
            content: `MCP Servers: ${connected.length} conectados${failed.length > 0 ? `, ${failed.length} falharam (${failed.map(s => s.name).join(', ')})` : ''}`,
          },
        })
      }
    }

    const result = await this.engine.execute({
      conversationId,
      stepId: step.id,
      message: input,
      systemPrompt,
      apiBaseUrl: step.baseUrl,
      projectPath,
      model: step.model || undefined,
      attachments,
      resumeToken,
      onEvent: makeOnEvent(monitor),
      onRawStdout: (chunk) => monitor.onStdout(chunk),
      onRawStderr: (chunk) => monitor.onStderr(chunk),
    })

    // If "Prompt is too long" and we were resuming a session, retry with a fresh session
    if (this.isPromptTooLongError(result.error) && resumeToken) {
      // Flush the failed trace first
      monitor.flush({
        exitCode: result.exitCode,
        signal: result.signal,
        resultStatus: 'error',
        errorMessage: result.error,
        contentLength: result.content.length,
        actionsCount: result.actions.length,
        resumeTokenOut: result.resumeToken,
      })

      // Notify the frontend that we are resetting the context
      orchestratorEvents.emitContextReset({
        executionId,
        conversationId,
        stepId: step.id,
        stepName: step.name,
        reason: 'O contexto da sessao excedeu o limite. Abrindo uma sessao nova automaticamente.',
      })

      // Delete the old session so we start fresh
      await sessionManager.deleteSession(conversationId, step.id)
      resumeToken = null

      // Create a new monitor for the retry
      const retryMonitor = new ExecutionMonitor(executionId, conversationId, step.id)
      if (userId) retryMonitor.setUserId(userId)
      retryMonitor.setInputMetadata({
        messageLength: input.length,
        systemPrompt,
        resumeToken: null,
        model: step.model || null,
        projectPath,
      })

      const retryResult = await this.engine.execute({
        conversationId,
        stepId: step.id,
        message: input,
        systemPrompt,
        apiBaseUrl: step.baseUrl,
        projectPath,
        model: step.model || undefined,
        attachments,
        resumeToken: null,
        onEvent: makeOnEvent(retryMonitor),
        onRawStdout: (chunk) => retryMonitor.onStdout(chunk),
        onRawStderr: (chunk) => retryMonitor.onStderr(chunk),
      })

      if (retryResult.resumeToken) {
        await sessionManager.saveSession(conversationId, step.id, retryResult.resumeToken)
      }

      let retryStatus = 'success'
      if (retryResult.error) retryStatus = 'error'
      else if (retryResult.timedOut) retryStatus = 'timeout'
      else if (retryResult.cancelled) retryStatus = 'cancelled'
      else if (retryResult.needsUserInput) retryStatus = 'needs_input'

      retryMonitor.flush({
        exitCode: retryResult.exitCode,
        signal: retryResult.signal,
        resultStatus: retryStatus,
        errorMessage: retryResult.error,
        contentLength: retryResult.content.length,
        actionsCount: retryResult.actions.length,
        resumeTokenOut: retryResult.resumeToken,
      })

      return retryResult
    }

    // Save session if we got a new one
    if (result.resumeToken) {
      await sessionManager.saveSession(conversationId, step.id, result.resumeToken)
    }

    // Determine status for monitoring
    let resultStatus = 'success'
    if (result.error) resultStatus = 'error'
    else if (result.timedOut) resultStatus = 'timeout'
    else if (result.cancelled) resultStatus = 'cancelled'
    else if (result.needsUserInput) resultStatus = 'needs_input'

    // Flush trace (fire-and-forget)
    monitor.flush({
      exitCode: result.exitCode,
      signal: result.signal,
      resultStatus,
      errorMessage: result.error,
      contentLength: result.content.length,
      actionsCount: result.actions.length,
      resumeTokenOut: result.resumeToken,
    })

    return result
  }

  async executeSequential(context: ExecutionContext, userInput: string): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

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
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const step = steps[i]

        await executionStateManager.updateStepIndex(executionId, i)

        await executionStateManager.logEvent(
          executionId,
          conversationId,
          'step_start',
          { stepOrder: i + 1, totalSteps: steps.length },
          step.id,
          step.name
        )

        orchestratorEvents.emitStepStart({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          stepOrder: i + 1,
          totalSteps: steps.length,
        })

        const result = await this.executeStep(
          executionId,
          conversationId,
          step,
          currentInput,
          projectPath,
          i === 0 ? attachments : undefined,
          userId,
        )

        if (result.cancelled || !this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          this.activeExecutions.delete(conversationId)
          return
        }

        if (result.error) {
          orchestratorEvents.emitStepError({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
            error: result.error,
          })

          await executionStateManager.markFailed(executionId, result.error)
          this.activeExecutions.delete(conversationId)
          return
        }

        // Run validators if configured
        let validatorConfigs: ValidatorConfig[] = []
        try { validatorConfigs = JSON.parse(step.validators || '[]') } catch { validatorConfigs = [] }

        if (validatorConfigs.length > 0) {
          const validation = await runValidators(validatorConfigs, result.content, projectPath)
          if (!validation.allPassed) {
            const failedResult = validation.results.find(r => !r.valid)
            const feedback = failedResult?.feedback || failedResult?.details || failedResult?.message || 'Validation failed'
            orchestratorEvents.emitValidationFailed({
              executionId,
              conversationId,
              stepId: step.id,
              stepName: step.name,
              validatorType: failedResult?.type || 'unknown',
              feedback,
            })
            // Retry: re-run same step with feedback
            const currentRetry = (retryCounts[`validator_${step.id}`] || 0) + 1
            const maxRetries = step.maxRetries || 2
            if (currentRetry < maxRetries) {
              retryCounts[`validator_${step.id}`] = currentRetry
              currentInput = `A validacao falhou: ${feedback}\n\nPor favor corrija e tente novamente. Output anterior:\n${result.content}`
              continue
            }
            delete retryCounts[`validator_${step.id}`]
          }
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: JSON.stringify({
              actions: result.actions,
              sessionId: result.resumeToken,
              stepName: step.name,
              stepOrder: i + 1,
            }),
          },
        })

        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, actions: result.actions },
        })

        // Save checkpoint after each successful step
        await executionStateManager.saveCheckpoint(executionId, i, result.content, result.content).catch(() => {})

        let conditionsData: unknown = step.conditions
        if (typeof step.conditions === 'string') {
          try { conditionsData = JSON.parse(step.conditions) } catch { conditionsData = null }
        }
        const conditions = (conditionsData || { rules: [], default: 'continue' }) as unknown as StepConditions
        const conditionResult = conditionsEvaluator.evaluate(result.content, conditions)

        const nextStep = conditionsEvaluator.resolveNextStep(
          conditionResult.action,
          steps.map((s) => ({ id: s.id, name: s.name })),
          i
        )

        if (nextStep.isRetry) {
          const currentRetry = (retryCounts[step.id] || 0) + 1
          const maxRetries = conditionResult.rule?.maxRetries || step.maxRetries || 3

          if (currentRetry >= maxRetries) {
            orchestratorEvents.emitStepComplete({
              executionId,
              conversationId,
              stepId: step.id,
              stepName: step.name,
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
              conditionResult.rule!
            )

            orchestratorEvents.emitConditionRetry({
              executionId,
              conversationId,
              stepId: step.id,
              retryCount: currentRetry,
              maxRetries,
              retryMessage,
            })

            currentInput = retryMessage
          }
        } else if (nextStep.isFinished) {
          orchestratorEvents.emitStepComplete({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.resumeToken || undefined,
            finished: true,
          })
          break
        } else {
          orchestratorEvents.emitStepComplete({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
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
                conditionResult.rule
              )

              orchestratorEvents.emitConditionJump({
                executionId,
                conversationId,
                fromStepId: step.id,
                toStepId: steps[nextStep.nextIndex]?.id || 'end',
                toStepIndex: nextStep.nextIndex,
              })

              i = nextStep.nextIndex
              currentInput = retryMessage
            }
          } else {
            const keysToDelete = Object.keys(retryCounts).filter(k => k.startsWith(`jump_${step.id}`))
            keysToDelete.forEach(k => delete retryCounts[k])

            if (nextStep.nextIndex !== i + 1) {
              orchestratorEvents.emitConditionJump({
                executionId,
                conversationId,
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
      orchestratorEvents.emitExecutionComplete({
        executionId,
        conversationId,
        success: true,
      })

      // Dispatch webhook
      if (userId) {
        webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      // Dispatch error webhook
      if (userId) {
        webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
      }
      throw error
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  async executeDAG(context: ExecutionContext, userInput: string): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

    const executionState = await executionStateManager.create(conversationId, 0)
    const executionId = executionState.id

    const dag = new DAGExecutor(steps)
    const validation = dag.validate()
    if (!validation.valid) {
      await executionStateManager.markFailed(executionId, validation.error || 'Invalid DAG')
      this.activeExecutions.delete(conversationId)
      throw new Error(validation.error || 'Invalid DAG')
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: steps[0]?.id,
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
      stepId: steps[0]?.id,
      stepName: steps[0]?.name,
      attachments: userMessage.attachments,
    })

    try {
      let batchIndex = 0
      while (!dag.isComplete()) {
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const readySteps = dag.getReadySteps()
        if (readySteps.length === 0) break

        orchestratorEvents.emitDagBatchStart({
          executionId,
          conversationId,
          stepIds: readySteps.map(s => s.step.id),
          batchIndex,
        })

        // Execute ready steps in parallel
        const results = await Promise.all(
          readySteps.map(async (dagStep) => {
            const depContext = dag.getDependencyContext(dagStep.step.id)
            const input = depContext ? `${userInput}\n\n${depContext}` : userInput

            orchestratorEvents.emitStepStart({
              executionId,
              conversationId,
              stepId: dagStep.step.id,
              stepName: dagStep.step.name,
              stepOrder: dagStep.index + 1,
              totalSteps: dag.totalSteps,
            })

            const result = await this.executeStep(
              executionId,
              conversationId,
              dagStep.step,
              input,
              projectPath,
              dagStep.index === 0 ? attachments : undefined,
              userId,
            )

            if (result.error) {
              orchestratorEvents.emitStepError({
                executionId,
                conversationId,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
                error: result.error,
              })
            } else {
              // Save assistant message
              const msg = await prisma.message.create({
                data: {
                  conversationId,
                  stepId: dagStep.step.id,
                  role: 'assistant',
                  content: result.content,
                  metadata: JSON.stringify({
                    actions: result.actions,
                    sessionId: result.resumeToken,
                    stepName: dagStep.step.name,
                    stepOrder: dagStep.index + 1,
                  }),
                },
              })
              orchestratorEvents.emitMessageSaved({
                executionId,
                conversationId,
                messageId: msg.id,
                role: 'assistant',
                content: result.content,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
              })

              orchestratorEvents.emitStepComplete({
                executionId,
                conversationId,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
                stepOrder: dagStep.index + 1,
                content: result.content,
                sessionId: result.resumeToken || undefined,
                finished: false,
              })
            }

            return { dagStep, result }
          })
        )

        // Mark completed and check for errors
        for (const { dagStep, result } of results) {
          if (result.error) {
            await executionStateManager.markFailed(executionId, result.error)
            this.activeExecutions.delete(conversationId)
            return
          }
          dag.markCompleted(dagStep.step.id, result.content)
        }

        batchIndex++
      }

      await executionStateManager.markCompleted(executionId)
      orchestratorEvents.emitExecutionComplete({ executionId, conversationId, success: true })

      if (userId) {
        webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      if (userId) {
        webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
      }
      throw error
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  async executeStepByStep(
    context: ExecutionContext,
    userInput: string,
    stepIndex: number
  ): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (stepIndex >= steps.length) {
      throw new Error('Step index out of bounds')
    }

    const step = steps[stepIndex]

    const executionState = await executionStateManager.create(conversationId, stepIndex)
    const executionId = executionState.id

    // Log step start
    await executionStateManager.logEvent(
      executionId,
      conversationId,
      'step_start',
      { stepOrder: stepIndex + 1, totalSteps: steps.length },
      step.id,
      step.name
    )

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: step.id,
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
      stepId: step.id,
      stepName: step.name,
      attachments: userMessage.attachments,
    })

    orchestratorEvents.emitStepStart({
      executionId,
      conversationId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: stepIndex + 1,
      totalSteps: steps.length,
    })

    try {
      const result = await this.executeStep(
        executionId,
        conversationId,
        step,
        userInput,
        projectPath,
        attachments,
        userId,
      )

      if (result.error) {
        await executionStateManager.logEvent(
          executionId,
          conversationId,
          'step_error',
          { error: result.error, stepOrder: stepIndex + 1 },
          step.id,
          step.name
        )
        orchestratorEvents.emitStepError({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          error: result.error,
        })
        await executionStateManager.markFailed(executionId, result.error)
        return
      }

      if (result.content) {
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: JSON.stringify({
              actions: result.actions,
              sessionId: result.resumeToken,
              stepName: step.name,
              stepOrder: stepIndex + 1,
              needsUserInput: result.needsUserInput,
            }),
          },
        })

        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, needsUserInput: result.needsUserInput, actions: result.actions },
        })
      }

      await executionStateManager.logEvent(
        executionId,
        conversationId,
        'step_complete',
        {
          stepOrder: stepIndex + 1,
          contentLength: result.content.length,
          actionsCount: result.actions.length,
          needsUserInput: result.needsUserInput,
        },
        step.id,
        step.name
      )

      orchestratorEvents.emitStepComplete({
        executionId,
        conversationId,
        stepId: step.id,
        stepName: step.name,
        stepOrder: stepIndex + 1,
        content: result.content,
        sessionId: result.resumeToken || undefined,
        finished: false,
        needsUserInput: result.needsUserInput,
      })

      await executionStateManager.markCompleted(executionId)
      orchestratorEvents.emitExecutionComplete({
        executionId,
        conversationId,
        success: true,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      throw error
    }
  }

  cancel(conversationId: string): boolean {
    this.activeExecutions.delete(conversationId)
    const killed = this.engine.cancel(conversationId)

    sessionManager.deleteAllSessions(conversationId).catch(() => {})

    return killed
  }

  isExecuting(conversationId: string): boolean {
    return this.activeExecutions.get(conversationId) === true
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.on(event, handler)
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.off(event, handler)
  }
}

export const taskOrchestrator = new TaskOrchestrator()
