import { prisma } from '../../../lib/prisma.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { DAGExecutor } from './dag-executor.js'
import { isStepError, getErrorMessage, decideOnError, FALLBACK_MESSAGE, resolveErrorHandler } from './step-error-handler.js'
import { webhooksService } from '../../webhooks/webhooks.service.js'
import type { Prisma } from '@prisma/client'
import type { ExecutionContext, OrchestratorDeps } from './orchestrator-types.js'
import { executeStep } from './step-executor.js'
import { finalizeExecution } from './orchestrator-utils.js'

// ---------------------------------------------------------------------------
// Inline concurrency limiter (semaphore pattern) — avoids external deps
// ---------------------------------------------------------------------------

interface ConcurrencyLimiter {
  <T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Creates a concurrency limiter that allows at most `limit` tasks to run
 * simultaneously. When `limit <= 0` the limiter is effectively unlimited
 * (all tasks start immediately).
 */
function createConcurrencyLimiter(limit: number): ConcurrencyLimiter {
  // Unlimited — just call fn directly
  if (limit <= 0) {
    return <T>(fn: () => Promise<T>) => fn()
  }

  let running = 0
  const queue: Array<() => void> = []

  function release() {
    running--
    if (queue.length > 0) {
      const next = queue.shift()!
      next()
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        running++
        fn().then(resolve, reject).finally(release)
      }

      if (running < limit) {
        run()
      } else {
        queue.push(run)
      }
    })
  }
}

// ---------------------------------------------------------------------------
// DAG Workflow Executor
// ---------------------------------------------------------------------------

export async function executeDAGWorkflow(
  deps: OrchestratorDeps,
  context: ExecutionContext,
  userInput: string,
): Promise<void> {
  const { conversationId, steps, projectPath, attachments, userId } = context
  const maxConcurrency = context.maxConcurrency ?? 0

  if (deps.activeExecutions.get(conversationId)) {
    throw new Error('Execution already in progress for this conversation')
  }

  deps.activeExecutions.set(conversationId, true)

  const executionState = await executionStateManager.create(conversationId, 0)
  const executionId = executionState.id

  const dag = new DAGExecutor(steps)
  const validation = dag.validate()
  if (!validation.valid) {
    await executionStateManager.markFailed(executionId, validation.error || 'Invalid DAG')
    deps.activeExecutions.delete(conversationId)
    throw new Error(validation.error || 'Invalid DAG')
  }

  // Create the concurrency limiter for this execution
  const limiter = createConcurrencyLimiter(maxConcurrency)

  if (maxConcurrency > 0) {
    console.log(`[DAG] Concurrency limit set to ${maxConcurrency} for conversation ${conversationId}`)
  }

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
    executionId, conversationId,
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
      if (!deps.activeExecutions.get(conversationId)) {
        orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
        await executionStateManager.markCancelled(executionId)
        return
      }

      const readySteps = dag.getReadySteps()
      if (readySteps.length === 0) break

      orchestratorEvents.emitDagBatchStart({
        executionId, conversationId,
        stepIds: readySteps.map(s => s.step.id),
        batchIndex,
      })

      // Execute ready steps through the concurrency limiter.
      // When maxConcurrency > 0, at most that many steps run simultaneously.
      // When maxConcurrency = 0 (unlimited), all ready steps start at once (same as before).
      const results = await Promise.all(
        readySteps.map((dagStep) =>
          limiter(async () => {
            const depContext = dag.getDependencyContext(dagStep.step.id)
            const input = depContext ? `${userInput}\n\n${depContext}` : userInput

            orchestratorEvents.emitStepStart({
              executionId, conversationId,
              stepId: dagStep.step.id,
              stepName: dagStep.step.name,
              stepOrder: dagStep.index + 1,
              totalSteps: dag.totalSteps,
            })

            let result = await executeStep(
              deps, executionId, conversationId, dagStep.step, input, projectPath,
              dagStep.index === 0 ? attachments : undefined, userId,
            )

            if (isStepError(result)) {
              const decision = decideOnError(dagStep.step, result)
              const errMsg = getErrorMessage(result)
              console.warn(decision.logMessage)

              orchestratorEvents.emitStepError({
                executionId, conversationId,
                stepId: dagStep.step.id, stepName: dagStep.step.name,
                error: `[${decision.action}] ${errMsg}`,
              })

              if (decision.action === 'fallback') {
                const fbResult = await executeStep(
                  deps, executionId, conversationId, dagStep.step,
                  FALLBACK_MESSAGE, projectPath, undefined, userId,
                )
                if (!isStepError(fbResult)) {
                  result = fbResult
                }
              }
            }

            if (!isStepError(result) || resolveErrorHandler(dagStep.step) !== 'fail') {
              const msg = await prisma.message.create({
                data: {
                  conversationId,
                  stepId: dagStep.step.id,
                  role: 'assistant',
                  content: result.content,
                  metadata: {
                    actions: result.actions,
                    sessionId: result.resumeToken,
                    stepName: dagStep.step.name,
                    stepOrder: dagStep.index + 1,
                  } as unknown as Prisma.InputJsonValue,
                },
              })
              orchestratorEvents.emitMessageSaved({
                executionId, conversationId,
                messageId: msg.id,
                role: 'assistant',
                content: result.content,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
              })

              orchestratorEvents.emitStepComplete({
                executionId, conversationId,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
                stepOrder: dagStep.index + 1,
                content: result.content,
                sessionId: result.resumeToken || undefined,
                finished: false,
              })
            }

            return { dagStep, result }
          }),
        ),
      )

      for (const { dagStep, result } of results) {
        if (isStepError(result)) {
          const handler = resolveErrorHandler(dagStep.step)
          if (handler === 'fail') {
            await executionStateManager.markFailed(executionId, getErrorMessage(result))
            deps.activeExecutions.delete(conversationId)
            return
          }
          dag.markCompleted(dagStep.step.id, result.content || '')
        } else {
          dag.markCompleted(dagStep.step.id, result.content)
        }
      }

      batchIndex++
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
