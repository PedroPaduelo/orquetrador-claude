import { prisma } from '../../../lib/prisma.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { isStepError, getErrorMessage, decideOnError, FALLBACK_MESSAGE } from './step-error-handler.js'
import type { Prisma } from '@prisma/client'
import type { PausedExecutionInfo } from './execution-state.js'
import type { ExecutionContext, OrchestratorDeps } from './orchestrator-types.js'
import { executeStep } from './step-executor.js'
import { finalizeExecution } from './orchestrator-utils.js'

export async function executeStepByStep(
  deps: OrchestratorDeps,
  context: ExecutionContext,
  userInput: string,
  stepIndex: number,
): Promise<void> {
  const { conversationId, steps, projectPath, attachments, userId } = context

  if (stepIndex >= steps.length) {
    throw new Error('Step index out of bounds')
  }

  const step = steps[stepIndex]

  const executionState = await executionStateManager.create(conversationId, stepIndex)
  const executionId = executionState.id

  await executionStateManager.logEvent(
    executionId, conversationId, 'step_start',
    { stepOrder: stepIndex + 1, totalSteps: steps.length },
    step.id, step.name,
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
    executionId, conversationId,
    messageId: userMessage.id,
    role: 'user',
    content: userInput,
    stepId: step.id, stepName: step.name,
    attachments: userMessage.attachments,
  })

  orchestratorEvents.emitStepStart({
    executionId, conversationId,
    stepId: step.id, stepName: step.name,
    stepOrder: stepIndex + 1, totalSteps: steps.length,
  })

  try {
    let result = await executeStep(
      deps, executionId, conversationId, step, userInput, projectPath, attachments, userId,
    )

    if (isStepError(result)) {
      const decision = decideOnError(step, result)
      const errMsg = getErrorMessage(result)
      console.warn(decision.logMessage)
      await executionStateManager.logEvent(
        executionId, conversationId, 'step_error',
        { error: errMsg, handler: decision.action, stepOrder: stepIndex + 1 },
        step.id, step.name,
      )
      orchestratorEvents.emitStepError({
        executionId, conversationId,
        stepId: step.id, stepName: step.name,
        error: `[${decision.action}] ${errMsg}`,
      })
      if (decision.action === 'fail') {
        await executionStateManager.markFailed(executionId, errMsg)
        return
      }
      if (decision.action === 'fallback') {
        const fbResult = await executeStep(
          deps, executionId, conversationId, step,
          FALLBACK_MESSAGE, projectPath, undefined, userId,
        )
        if (isStepError(fbResult)) {
          await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
          return
        }
        result = fbResult
      }
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
      return
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

    await executionStateManager.logEvent(
      executionId, conversationId, 'step_complete',
      {
        stepOrder: stepIndex + 1,
        contentLength: result.content.length,
        actionsCount: result.actions.length,
      },
      step.id, step.name,
    )

    orchestratorEvents.emitStepComplete({
      executionId, conversationId,
      stepId: step.id, stepName: step.name,
      stepOrder: stepIndex + 1,
      content: result.content,
      sessionId: result.resumeToken || undefined,
      finished: false,
    })

    await executionStateManager.markCompleted(executionId)
    finalizeExecution(executionId, conversationId)
    orchestratorEvents.emitExecutionComplete({ executionId, conversationId, success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await executionStateManager.markFailed(executionId, errorMessage)
    finalizeExecution(executionId, conversationId)
    throw error
  }
}
