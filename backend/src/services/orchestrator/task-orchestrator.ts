import { prisma } from '../../lib/prisma.js'
import { claudeService } from '../claude/claude-service.js'
import { conditionsEvaluator, type StepConditions } from './conditions-evaluator.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { smartNotesService } from '../smart-notes/context-builder.js'
import type { WorkflowStep } from '@prisma/client'

export interface ExecutionContext {
  conversationId: string
  workflowId: string
  steps: WorkflowStep[]
  projectPath: string
}

export class TaskOrchestrator {
  private activeExecutions = new Map<string, boolean>()

  async executeSequential(context: ExecutionContext, userInput: string): Promise<void> {
    const { conversationId, steps, projectPath } = context

    // Check if already executing
    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

    // Create execution state
    const executionState = await executionStateManager.create(conversationId)
    const executionId = executionState.id

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: steps[0]?.id,
        role: 'user',
        content: userInput,
      },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      messageId: userMessage.id,
      role: 'user',
      content: userInput,
    })

    let currentInput = userInput
    let retryCounts: Record<string, number> = {}

    try {
      let i = 0
      while (i < steps.length) {
        // Check if cancelled
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const step = steps[i]

        // Update execution state
        await executionStateManager.updateStepIndex(executionId, i)

        // Log step start
        await executionStateManager.logEvent(
          executionId,
          conversationId,
          'step_start',
          { stepOrder: i + 1, totalSteps: steps.length },
          step.id,
          step.name
        )

        // Emit step start event
        orchestratorEvents.emitStepStart({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          stepOrder: i + 1,
          totalSteps: steps.length,
        })

        // Build system prompt with Smart Notes
        const systemPrompt = await smartNotesService.buildSystemPrompt(step)

        // Execute Claude
        const result = await claudeService.execute({
          conversationId,
          stepId: step.id,
          message: currentInput,
          systemPrompt,
          baseUrl: step.baseUrl,
          projectPath,
          onEvent: (event) => {
            if (event.type === 'content' && event.content) {
              orchestratorEvents.emitStepStream({
                executionId,
                stepId: step.id,
                type: 'content',
                content: event.content,
              })
            } else if (event.type === 'action' && event.action) {
              orchestratorEvents.emitStepStream({
                executionId,
                stepId: step.id,
                type: 'action',
                action: event.action,
              })
            }
          },
        })

        // Check if cancelled during execution
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        // Handle errors
        if (result.error) {
          orchestratorEvents.emitStepError({
            executionId,
            stepId: step.id,
            stepName: step.name,
            error: result.error,
          })

          await executionStateManager.markFailed(executionId, result.error)
          this.activeExecutions.delete(conversationId)
          return
        }

        // Save assistant message
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: {
              actions: result.actions as object[],
              sessionId: result.sessionId,
              stepName: step.name,
              stepOrder: i + 1,
            },
          },
        })

        orchestratorEvents.emitMessageSaved({
          executionId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          metadata: { sessionId: result.sessionId },
        })

        // Evaluate conditions
        const conditions = (step.conditions || { rules: [], default: 'continue' }) as unknown as StepConditions
        const conditionResult = conditionsEvaluator.evaluate(result.content, conditions)

        // Resolve next step
        const nextStep = conditionsEvaluator.resolveNextStep(
          conditionResult.action,
          steps.map((s) => ({ id: s.id, name: s.name })),
          i
        )

        // Handle retry
        if (nextStep.isRetry) {
          const currentRetry = (retryCounts[step.id] || 0) + 1
          const maxRetries = conditionResult.rule?.maxRetries || step.maxRetries || 3

          if (currentRetry >= maxRetries) {
            // Max retries reached, move to next
            orchestratorEvents.emitStepComplete({
              executionId,
              stepId: step.id,
              stepName: step.name,
              stepOrder: i + 1,
              content: result.content,
              sessionId: result.sessionId || undefined,
              finished: false,
            })

            delete retryCounts[step.id]
            i++
            currentInput = result.content
          } else {
            // Retry
            retryCounts[step.id] = currentRetry
            await executionStateManager.updateRetryCounts(executionId, retryCounts)

            const retryMessage = conditionsEvaluator.formatRetryMessage(
              conditionResult.rule?.retryMessage,
              result.content,
              conditionResult.rule!
            )

            orchestratorEvents.emitConditionRetry({
              executionId,
              stepId: step.id,
              retryCount: currentRetry,
              maxRetries,
              retryMessage,
            })

            currentInput = retryMessage
            // i stays the same for retry
          }
        } else if (nextStep.isFinished) {
          // Workflow finished
          orchestratorEvents.emitStepComplete({
            executionId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.sessionId || undefined,
            finished: true,
          })
          break
        } else {
          // Move to next/jump step
          orchestratorEvents.emitStepComplete({
            executionId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.sessionId || undefined,
            finished: nextStep.nextIndex >= steps.length,
          })

          if (nextStep.nextIndex !== i + 1) {
            orchestratorEvents.emitConditionJump({
              executionId,
              fromStepId: step.id,
              toStepId: steps[nextStep.nextIndex]?.id || 'end',
              toStepIndex: nextStep.nextIndex,
            })
          }

          i = nextStep.nextIndex
          currentInput = result.content
        }
      }

      // Mark as completed
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
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  async executeStepByStep(
    context: ExecutionContext,
    userInput: string,
    stepIndex: number
  ): Promise<void> {
    const { conversationId, steps, projectPath } = context

    if (stepIndex >= steps.length) {
      throw new Error('Step index out of bounds')
    }

    const step = steps[stepIndex]

    // Create execution state
    const executionState = await executionStateManager.create(conversationId)
    const executionId = executionState.id

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: step.id,
        role: 'user',
        content: userInput,
      },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      messageId: userMessage.id,
      role: 'user',
      content: userInput,
    })

    // Emit step start
    orchestratorEvents.emitStepStart({
      executionId,
      conversationId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: stepIndex + 1,
      totalSteps: steps.length,
    })

    try {
      // Build system prompt
      const systemPrompt = await smartNotesService.buildSystemPrompt(step)

      // Execute Claude
      const result = await claudeService.execute({
        conversationId,
        stepId: step.id,
        message: userInput,
        systemPrompt,
        baseUrl: step.baseUrl,
        projectPath,
        onEvent: (event) => {
          if (event.type === 'content' && event.content) {
            orchestratorEvents.emitStepStream({
              executionId,
              stepId: step.id,
              type: 'content',
              content: event.content,
            })
          } else if (event.type === 'action' && event.action) {
            orchestratorEvents.emitStepStream({
              executionId,
              stepId: step.id,
              type: 'action',
              action: event.action,
            })
          }
        },
      })

      // Handle errors
      if (result.error) {
        orchestratorEvents.emitStepError({
          executionId,
          stepId: step.id,
          stepName: step.name,
          error: result.error,
        })
        await executionStateManager.markFailed(executionId, result.error)
        return
      }

      // Save assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          stepId: step.id,
          role: 'assistant',
          content: result.content,
          metadata: {
            actions: result.actions as object[],
            sessionId: result.sessionId,
            stepName: step.name,
            stepOrder: stepIndex + 1,
          },
        },
      })

      orchestratorEvents.emitMessageSaved({
        executionId,
        messageId: assistantMessage.id,
        role: 'assistant',
        content: result.content,
        stepId: step.id,
        metadata: { sessionId: result.sessionId },
      })

      // Update conversation current step
      const nextStepIndex = stepIndex + 1
      if (nextStepIndex < steps.length) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { currentStepId: steps[nextStepIndex].id },
        })
      }

      // Emit completion
      orchestratorEvents.emitStepComplete({
        executionId,
        stepId: step.id,
        stepName: step.name,
        stepOrder: stepIndex + 1,
        content: result.content,
        sessionId: result.sessionId || undefined,
        finished: nextStepIndex >= steps.length,
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
    return claudeService.cancel(conversationId)
  }

  isExecuting(conversationId: string): boolean {
    return this.activeExecutions.get(conversationId) === true
  }

  // Event subscription helpers
  on(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.on(event, handler)
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.off(event, handler)
  }
}

export const taskOrchestrator = new TaskOrchestrator()
