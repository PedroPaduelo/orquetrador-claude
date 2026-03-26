import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { taskOrchestrator } from '../execution/orchestrator/task-orchestrator.js'
import { orchestratorEvents } from '../execution/orchestrator/events.js'
import { isDAGWorkflow } from '../execution/orchestrator/dag-executor.js'
import { getMaxConcurrency } from '../execution/orchestrator/orchestrator-utils.js'
import { validateProjectPath } from '../../lib/validation.js'
import { projectPathLock } from '../execution/lock/project-path-lock.js'
import { tokenBudgetService } from '../execution/budget/token-budget-service.js'
import { conversationsRepository } from '../conversations/conversations.repository.js'
import { NotFoundError, BadRequestError } from '../../http/errors/index.js'
import { enqueueExecution } from '../execution/queue/execution-queue.js'
import type { ExecutionJobData } from '../execution/queue/execution-queue.js'
import type {
  StepErrorEvent,
  ExecutionCompleteEvent,
  ExecutionCancelledEvent,
  ExecutionPausedEvent,
} from '../execution/orchestrator/events.js'

// ─── Helpers ────────────────────────────────────────────────────────

async function getOrCreateConversation(
  workflowId: string,
  projectPath: string,
  userId: string,
  conversationId?: string,
) {
  if (conversationId) {
    const existing = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    })
    if (!existing) throw new NotFoundError('Conversation not found')
    if (existing.workflowId !== workflowId) {
      throw new BadRequestError('Conversation does not belong to this workflow')
    }
    return existing
  }

  // Create new conversation
  const created = await conversationsRepository.create(
    { workflowId, projectPath, title: `API Execution` },
    userId,
  )
  if (!created) throw new NotFoundError('Workflow not found')

  // Re-fetch with full relations
  const conversation = await prisma.conversation.findUnique({
    where: { id: created.id },
    include: {
      workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
    },
  })
  return conversation!
}

async function collectExecutionResult(conversationId: string) {
  const messages = await prisma.message.findMany({
    where: { conversationId, role: 'assistant' },
    orderBy: { createdAt: 'asc' },
    include: { step: { select: { name: true, stepOrder: true } } },
  })

  const steps = messages.map((m) => ({
    stepName: m.step?.name ?? 'unknown',
    stepOrder: m.step?.stepOrder ?? 0,
    content: m.content,
  }))

  const lastMessage = messages[messages.length - 1]

  return {
    content: lastMessage?.content ?? '',
    steps,
    messagesCount: messages.length,
  }
}

/** Build jobData for the execution queue from conversation context */
function buildJobData(opts: {
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>
  userId: string
  message: string
  projectPath: string
  pausedExecution?: {
    executionId: string
    stepIndex: number
    stepId: string
    resumeToken: string | null
    askUserQuestion?: { question: string; options?: Array<{ label: string; description?: string }> }
  } | null
}): ExecutionJobData {
  const { conversation, userId, message, projectPath, pausedExecution } = opts
  const currentIndex = conversation.currentStepId
    ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
    : 0

  return {
    conversationId: conversation.id,
    workflowId: conversation.workflowId,
    userId,
    content: message,
    projectPath,
    workflowType: conversation.workflow.type,
    maxConcurrency: getMaxConcurrency(conversation.workflow.config),
    stepIndex: Math.max(0, currentIndex),
    ...(pausedExecution ? {
      isResume: true,
      pausedExecutionId: pausedExecution.executionId,
      pausedStepIndex: pausedExecution.stepIndex,
      pausedStepId: pausedExecution.stepId,
      pausedResumeToken: pausedExecution.resumeToken,
      pausedAskUserQuestion: pausedExecution.askUserQuestion,
    } : {}),
  }
}

/** Fallback: run execution directly via taskOrchestrator (used when Redis/queue is unavailable) */
async function executeDirectFallback(
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  message: string,
  projectPath: string,
  userId: string,
): Promise<void> {
  const context = {
    conversationId: conversation.id,
    workflowId: conversation.workflowId,
    steps: conversation.workflow.steps,
    projectPath,
    userId,
    maxConcurrency: getMaxConcurrency(conversation.workflow.config),
  }

  const pausedExecution = await taskOrchestrator.getPausedExecution(conversation.id)
  if (pausedExecution) {
    await taskOrchestrator.resumeExecution(context, message, pausedExecution)
  } else if (conversation.workflow.type === 'sequential' && isDAGWorkflow(conversation.workflow.steps)) {
    await taskOrchestrator.executeDAG(context, message)
  } else if (conversation.workflow.type === 'sequential') {
    await taskOrchestrator.executeSequential(context, message)
  } else {
    const currentIndex = conversation.currentStepId
      ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
      : 0
    await taskOrchestrator.executeStepByStep(context, message, Math.max(0, currentIndex))
  }
}

// ─── Routes ─────────────────────────────────────────────────────────

export async function workflowApiRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // ── POST /api/v1/workflows/:id/execute ── Sync execution (waits for result)
  server.post(
    '/api/v1/workflows/:id/execute',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Execute a workflow and wait for result',
        params: z.object({ id: z.string() }),
        body: z.object({
          message: z.string().min(1),
          projectPath: z.string(),
          conversationId: z.string().optional(),
          timeoutMs: z.number().min(5000).max(1800000).optional().default(600000),
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            status: z.enum(['completed', 'paused', 'error']),
            result: z.object({
              content: z.string(),
              steps: z.array(z.object({
                stepName: z.string(),
                stepOrder: z.number(),
                content: z.string(),
              })),
              messagesCount: z.number(),
            }),
            pausedInfo: z.object({
              stepName: z.string().optional(),
              question: z.string().optional(),
              options: z.array(z.object({
                label: z.string(),
                description: z.string().optional(),
              })).optional(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { id: workflowId } = request.params as { id: string }
      const { message, projectPath: rawPath, conversationId, timeoutMs } = request.body as {
        message: string
        projectPath: string
        conversationId?: string
        timeoutMs: number
      }

      // Budget check
      const budgetCheck = await tokenBudgetService.checkBudget(userId)
      if (!budgetCheck.allowed) {
        throw new BadRequestError(budgetCheck.reason || 'Token budget exceeded')
      }

      const projectPath = validateProjectPath(rawPath)
      const conversation = await getOrCreateConversation(workflowId, projectPath, userId, conversationId)

      // Cancel stale execution
      if (taskOrchestrator.isExecuting(conversation.id)) {
        taskOrchestrator.cancel(conversation.id)
        await new Promise((r) => setTimeout(r, 500))
      }

      const releaseLock = await projectPathLock.acquire(projectPath)

      try {
        const result = await new Promise<{
          status: 'completed' | 'paused' | 'error'
          error?: string
          pausedInfo?: ExecutionPausedEvent
        }>((resolve) => {
          const timeout = setTimeout(() => {
            cleanup()
            taskOrchestrator.cancel(conversation.id)
            resolve({ status: 'error', error: 'Execution timed out' })
          }, timeoutMs)

          const onComplete = (data: ExecutionCompleteEvent) => {
            if (data.conversationId !== conversation.id) return
            cleanup()
            resolve({ status: 'completed' })
          }

          const onError = (data: StepErrorEvent) => {
            if (data.conversationId !== conversation.id) return
            cleanup()
            resolve({ status: 'error', error: data.error })
          }

          const onCancelled = (data: ExecutionCancelledEvent) => {
            if (data.conversationId !== conversation.id) return
            cleanup()
            resolve({ status: 'error', error: 'Execution cancelled' })
          }

          const onPaused = (data: ExecutionPausedEvent) => {
            if (data.conversationId !== conversation.id) return
            cleanup()
            resolve({ status: 'paused', pausedInfo: data })
          }

          const cleanup = () => {
            clearTimeout(timeout)
            orchestratorEvents.off('execution:complete', onComplete)
            orchestratorEvents.off('step:error', onError)
            orchestratorEvents.off('execution:cancelled', onCancelled)
            orchestratorEvents.off('execution:paused', onPaused)
          }

          orchestratorEvents.on('execution:complete', onComplete)
          orchestratorEvents.on('step:error', onError)
          orchestratorEvents.on('execution:cancelled', onCancelled)
          orchestratorEvents.on('execution:paused', onPaused)

          // Start execution via BullMQ queue (with direct fallback)
          const startExecution = async () => {
            try {
              const pausedExecution = await taskOrchestrator.getPausedExecution(conversation.id)
              const jobData = buildJobData({ conversation, userId, message, projectPath, pausedExecution })
              try {
                await enqueueExecution(jobData)
              } catch (queueErr) {
                console.warn('[WorkflowAPI] Queue unavailable, falling back to direct execution:', (queueErr as Error).message)
                await executeDirectFallback(conversation, message, projectPath, userId)
              }
            } catch (err) {
              cleanup()
              resolve({
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown execution error',
              })
            }
          }

          startExecution()
        })

        const executionResult = await collectExecutionResult(conversation.id)

        return {
          conversationId: conversation.id,
          status: result.status,
          result: executionResult,
          pausedInfo: result.pausedInfo
            ? {
                stepName: result.pausedInfo.stepName,
                question: result.pausedInfo.askUserQuestion?.question,
                options: result.pausedInfo.askUserQuestion?.options,
              }
            : null,
        }
      } finally {
        releaseLock()
      }
    },
  )

  // ── POST /api/v1/workflows/:id/execute/stream ── SSE streaming execution
  server.post(
    '/api/v1/workflows/:id/execute/stream',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Execute a workflow with SSE streaming',
        params: z.object({ id: z.string() }),
        body: z.object({
          message: z.string().min(1),
          projectPath: z.string(),
          conversationId: z.string().optional(),
        }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = await request.getCurrentUserId()
      const { id: workflowId } = request.params as { id: string }
      const { message, projectPath: rawPath, conversationId } = request.body as {
        message: string
        projectPath: string
        conversationId?: string
      }

      const budgetCheck = await tokenBudgetService.checkBudget(userId)
      if (!budgetCheck.allowed) {
        return reply.status(429).send({ message: budgetCheck.reason })
      }

      const projectPath = validateProjectPath(rawPath)
      const conversation = await getOrCreateConversation(workflowId, projectPath, userId, conversationId)

      if (taskOrchestrator.isExecuting(conversation.id)) {
        taskOrchestrator.cancel(conversation.id)
        await new Promise((r) => setTimeout(r, 500))
      }

      // SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'X-Accel-Buffering': 'no',
      })

      const sendEvent = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`)
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch { /* closed */ }
      }

      // Send conversationId as first event
      sendEvent('init', { conversationId: conversation.id })

      const heartbeat = setInterval(() => {
        try { reply.raw.write(`:heartbeat\n\n`) } catch { clearInterval(heartbeat) }
      }, 15_000)

      const filter = (data: { conversationId?: string }) => data.conversationId === conversation.id

      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (d: unknown) => { if (filter(d as never)) sendEvent('step_start', d) },
        'step:stream': (d: unknown) => { if (filter(d as never)) sendEvent('stream', d) },
        'step:complete': (d: unknown) => { if (filter(d as never)) sendEvent('step_complete', d) },
        'step:error': (d: unknown) => { if (filter(d as never)) sendEvent('step_error', d) },
        'message:saved': (d: unknown) => { if (filter(d as never)) sendEvent('message_saved', d) },
        'condition:retry': (d: unknown) => { if (filter(d as never)) sendEvent('condition_retry', d) },
        'condition:jump': (d: unknown) => { if (filter(d as never)) sendEvent('condition_jump', d) },
        'context:reset': (d: unknown) => { if (filter(d as never)) sendEvent('context_reset', d) },
        'execution:cancelled': (d: unknown) => { if (filter(d as never)) sendEvent('cancelled', d) },
        'execution:complete': (d: unknown) => { if (filter(d as never)) sendEvent('complete', d) },
        'dag:batch_start': (d: unknown) => { if (filter(d as never)) sendEvent('dag_batch_start', d) },
        'validation:failed': (d: unknown) => { if (filter(d as never)) sendEvent('validation_failed', d) },
        'execution:paused': (d: unknown) => { if (filter(d as never)) sendEvent('execution_paused', d) },
        'execution:resumed': (d: unknown) => { if (filter(d as never)) sendEvent('execution_resumed', d) },
        'user:interrupt': (d: unknown) => { if (filter(d as never)) sendEvent('user_interrupt', d) },
      }

      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      const cleanup = () => {
        clearInterval(heartbeat)
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      }

      request.raw.on('close', () => {
        cleanup()
        if (taskOrchestrator.isExecuting(conversation.id)) {
          taskOrchestrator.cancel(conversation.id)
        }
      })

      let releaseLock: (() => void) | null = null
      try {
        releaseLock = await projectPathLock.acquire(projectPath)

        const pausedExecution = await taskOrchestrator.getPausedExecution(conversation.id)
        const jobData = buildJobData({ conversation, userId, message, projectPath, pausedExecution })

        try {
          await enqueueExecution(jobData)
          // Worker runs in same process, events fire locally via EventEmitter.
          // The SSE handlers above will receive events and stream them to the client.
          // We wait for completion/error/cancel via a one-shot promise.
          await new Promise<void>((resolve) => {
            const onDone = (data: { conversationId?: string }) => {
              if (data.conversationId !== conversation.id) return
              orchestratorEvents.off('execution:complete', onDone)
              orchestratorEvents.off('step:error', onDone)
              orchestratorEvents.off('execution:cancelled', onDone)
              resolve()
            }
            orchestratorEvents.on('execution:complete', onDone)
            orchestratorEvents.on('step:error', onDone)
            orchestratorEvents.on('execution:cancelled', onDone)
          })
        } catch (queueErr) {
          console.warn('[WorkflowAPI] Queue unavailable for SSE, falling back to direct execution:', (queueErr as Error).message)
          await executeDirectFallback(conversation, message, projectPath, userId)
        }
      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        if (releaseLock) releaseLock()
        cleanup()
        try { if (!reply.raw.destroyed) reply.raw.end() } catch { /* closed */ }
      }
    },
  )

  // ── POST /api/v1/workflows/:id/execute/async ── Async (fire-and-forget)
  server.post(
    '/api/v1/workflows/:id/execute/async',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Start workflow execution asynchronously',
        params: z.object({ id: z.string() }),
        body: z.object({
          message: z.string().min(1),
          projectPath: z.string(),
          conversationId: z.string().optional(),
        }),
        response: {
          202: z.object({
            conversationId: z.string(),
            status: z.literal('started'),
            startedAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { id: workflowId } = request.params as { id: string }
      const { message, projectPath: rawPath, conversationId } = request.body as {
        message: string
        projectPath: string
        conversationId?: string
      }

      const budgetCheck = await tokenBudgetService.checkBudget(userId)
      if (!budgetCheck.allowed) {
        throw new BadRequestError(budgetCheck.reason || 'Token budget exceeded')
      }

      const projectPath = validateProjectPath(rawPath)
      const conversation = await getOrCreateConversation(workflowId, projectPath, userId, conversationId)

      if (taskOrchestrator.isExecuting(conversation.id)) {
        taskOrchestrator.cancel(conversation.id)
        await new Promise((r) => setTimeout(r, 500))
      }

      // Fire and forget — enqueue via BullMQ (with direct fallback)
      try {
        const pausedExecution = await taskOrchestrator.getPausedExecution(conversation.id)
        const jobData = buildJobData({ conversation, userId, message, projectPath, pausedExecution })
        await enqueueExecution(jobData)
      } catch (queueErr) {
        console.warn('[WorkflowAPI] Queue unavailable for async, falling back to direct execution:', (queueErr as Error).message)
        // Fire and forget with direct execution
        const runInBackground = async () => {
          let releaseLock: (() => void) | null = null
          try {
            releaseLock = await projectPathLock.acquire(projectPath)
            await executeDirectFallback(conversation, message, projectPath, userId)
          } catch (err) {
            console.error(`[WorkflowAPI] Background execution error for ${conversation.id}:`, err)
          } finally {
            if (releaseLock) releaseLock()
          }
        }
        runInBackground()
      }

      return reply.status(202).send({
        conversationId: conversation.id,
        status: 'started' as const,
        startedAt: new Date().toISOString(),
      })
    },
  )

  // ── GET /api/v1/executions/:conversationId ── Get execution status & result
  server.get(
    '/api/v1/executions/:conversationId',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Get execution status and result',
        params: z.object({ conversationId: z.string() }),
        response: {
          200: z.object({
            conversationId: z.string(),
            workflowId: z.string(),
            workflowName: z.string(),
            status: z.enum(['running', 'paused', 'completed', 'idle']),
            result: z.object({
              content: z.string(),
              steps: z.array(z.object({
                stepName: z.string(),
                stepOrder: z.number(),
                content: z.string(),
              })),
              messagesCount: z.number(),
            }),
            pausedInfo: z.object({
              executionId: z.string(),
              stepId: z.string(),
              stepIndex: z.number(),
              question: z.string().optional(),
              options: z.array(z.object({
                label: z.string(),
                description: z.string().optional(),
              })).optional(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { conversationId } = request.params as { conversationId: string }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { workflow: { select: { id: true, name: true } } },
      })
      if (!conversation) throw new NotFoundError('Conversation not found')

      const isExecuting = taskOrchestrator.isExecuting(conversationId)
      const pausedExecution = await taskOrchestrator.getPausedExecution(conversationId)

      let status: 'running' | 'paused' | 'completed' | 'idle'
      if (isExecuting) status = 'running'
      else if (pausedExecution) status = 'paused'
      else {
        // Check if there are any messages (completed) or not (idle)
        const msgCount = await prisma.message.count({ where: { conversationId } })
        status = msgCount > 0 ? 'completed' : 'idle'
      }

      const result = await collectExecutionResult(conversationId)

      return {
        conversationId,
        workflowId: conversation.workflow.id,
        workflowName: conversation.workflow.name,
        status,
        result,
        pausedInfo: pausedExecution
          ? {
              executionId: pausedExecution.executionId,
              stepId: pausedExecution.stepId,
              stepIndex: pausedExecution.stepIndex,
              question: pausedExecution.askUserQuestion?.question,
              options: pausedExecution.askUserQuestion?.options,
            }
          : null,
      }
    },
  )

  // ── GET /api/v1/executions/:conversationId/stream ── Watch execution via SSE
  server.get(
    '/api/v1/executions/:conversationId/stream',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Watch an active execution via SSE (read-only)',
        params: z.object({ conversationId: z.string() }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await request.getCurrentUserId()
      const { conversationId } = request.params as { conversationId: string }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'X-Accel-Buffering': 'no',
      })

      const sendEvent = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`)
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch { /* closed */ }
      }

      const heartbeat = setInterval(() => {
        try { reply.raw.write(`:heartbeat\n\n`) } catch { clearInterval(heartbeat) }
      }, 15_000)

      const filter = (data: { conversationId?: string }) => data.conversationId === conversationId

      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (d: unknown) => { if (filter(d as never)) sendEvent('step_start', d) },
        'step:stream': (d: unknown) => { if (filter(d as never)) sendEvent('stream', d) },
        'step:complete': (d: unknown) => { if (filter(d as never)) sendEvent('step_complete', d) },
        'step:error': (d: unknown) => { if (filter(d as never)) sendEvent('step_error', d) },
        'message:saved': (d: unknown) => { if (filter(d as never)) sendEvent('message_saved', d) },
        'execution:complete': (d: unknown) => {
          if (filter(d as never)) {
            sendEvent('complete', d)
            cleanup()
            try { if (!reply.raw.destroyed) reply.raw.end() } catch { /* closed */ }
          }
        },
        'execution:cancelled': (d: unknown) => { if (filter(d as never)) sendEvent('cancelled', d) },
        'execution:paused': (d: unknown) => { if (filter(d as never)) sendEvent('execution_paused', d) },
        'validation:failed': (d: unknown) => { if (filter(d as never)) sendEvent('validation_failed', d) },
      }

      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      const cleanup = () => {
        clearInterval(heartbeat)
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      }

      request.raw.on('close', () => { cleanup() })

      if (!taskOrchestrator.isExecuting(conversationId)) {
        sendEvent('no_active_execution', { conversationId })
        cleanup()
        try { if (!reply.raw.destroyed) reply.raw.end() } catch { /* closed */ }
      }
    },
  )

  // ── POST /api/v1/executions/:conversationId/message ── Send follow-up message
  server.post(
    '/api/v1/executions/:conversationId/message',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Send a follow-up message to an existing conversation (sync)',
        params: z.object({ conversationId: z.string() }),
        body: z.object({
          message: z.string().min(1),
          timeoutMs: z.number().min(5000).max(1800000).optional().default(600000),
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            status: z.enum(['completed', 'paused', 'error']),
            result: z.object({
              content: z.string(),
              steps: z.array(z.object({
                stepName: z.string(),
                stepOrder: z.number(),
                content: z.string(),
              })),
              messagesCount: z.number(),
            }),
            pausedInfo: z.object({
              stepName: z.string().optional(),
              question: z.string().optional(),
              options: z.array(z.object({
                label: z.string(),
                description: z.string().optional(),
              })).optional(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { conversationId } = request.params as { conversationId: string }
      const { message, timeoutMs } = request.body as { message: string; timeoutMs: number }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        },
      })
      if (!conversation) throw new NotFoundError('Conversation not found')
      if (!conversation.projectPath) throw new BadRequestError('Conversation has no project path')

      const budgetCheck = await tokenBudgetService.checkBudget(userId)
      if (!budgetCheck.allowed) {
        throw new BadRequestError(budgetCheck.reason || 'Token budget exceeded')
      }

      if (taskOrchestrator.isExecuting(conversationId)) {
        // If already executing, interrupt with the new message
        taskOrchestrator.interruptExecution(conversationId, message)
        return {
          conversationId,
          status: 'completed' as const,
          result: await collectExecutionResult(conversationId),
          pausedInfo: null,
        }
      }

      const projectPath = conversation.projectPath
      const releaseLock = await projectPathLock.acquire(projectPath)

      try {
        const result = await new Promise<{
          status: 'completed' | 'paused' | 'error'
          pausedInfo?: ExecutionPausedEvent
        }>((resolve) => {
          const timeout = setTimeout(() => {
            cleanup()
            taskOrchestrator.cancel(conversationId)
            resolve({ status: 'error' })
          }, timeoutMs)

          const onComplete = (data: ExecutionCompleteEvent) => {
            if (data.conversationId !== conversationId) return
            cleanup()
            resolve({ status: 'completed' })
          }

          const onError = (data: StepErrorEvent) => {
            if (data.conversationId !== conversationId) return
            cleanup()
            resolve({ status: 'error' })
          }

          const onCancelled = (data: ExecutionCancelledEvent) => {
            if (data.conversationId !== conversationId) return
            cleanup()
            resolve({ status: 'error' })
          }

          const onPaused = (data: ExecutionPausedEvent) => {
            if (data.conversationId !== conversationId) return
            cleanup()
            resolve({ status: 'paused', pausedInfo: data })
          }

          const cleanup = () => {
            clearTimeout(timeout)
            orchestratorEvents.off('execution:complete', onComplete)
            orchestratorEvents.off('step:error', onError)
            orchestratorEvents.off('execution:cancelled', onCancelled)
            orchestratorEvents.off('execution:paused', onPaused)
          }

          orchestratorEvents.on('execution:complete', onComplete)
          orchestratorEvents.on('step:error', onError)
          orchestratorEvents.on('execution:cancelled', onCancelled)
          orchestratorEvents.on('execution:paused', onPaused)

          // Start execution via BullMQ queue (with direct fallback)
          const startExecution = async () => {
            try {
              const pausedExecution = await taskOrchestrator.getPausedExecution(conversationId)
              const jobData = buildJobData({
                conversation: conversation as Awaited<ReturnType<typeof getOrCreateConversation>>,
                userId,
                message,
                projectPath,
                pausedExecution,
              })
              try {
                await enqueueExecution(jobData)
              } catch (queueErr) {
                console.warn('[WorkflowAPI] Queue unavailable for message endpoint, falling back to direct execution:', (queueErr as Error).message)
                await executeDirectFallback(
                  conversation as Awaited<ReturnType<typeof getOrCreateConversation>>,
                  message, projectPath, userId,
                )
              }
            } catch (err) {
              cleanup()
              resolve({ status: 'error' })
            }
          }

          startExecution()
        })

        const executionResult = await collectExecutionResult(conversationId)

        return {
          conversationId,
          status: result.status,
          result: executionResult,
          pausedInfo: result.pausedInfo
            ? {
                stepName: result.pausedInfo.stepName,
                question: result.pausedInfo.askUserQuestion?.question,
                options: result.pausedInfo.askUserQuestion?.options,
              }
            : null,
        }
      } finally {
        releaseLock()
      }
    },
  )

  // ── POST /api/v1/executions/:conversationId/cancel ── Cancel execution
  server.post(
    '/api/v1/executions/:conversationId/cancel',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'Cancel an active execution',
        params: z.object({ conversationId: z.string() }),
        body: z.any().optional(),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { conversationId } = request.params as { conversationId: string }

      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
      if (!conversation) throw new NotFoundError('Conversation not found')

      if (!taskOrchestrator.isExecuting(conversationId)) {
        return { success: false, message: 'No active execution to cancel' }
      }

      taskOrchestrator.cancel(conversationId)
      return { success: true, message: 'Execution cancelled' }
    },
  )

  // ── GET /api/v1/workflows ── List available workflows (for discovery)
  server.get(
    '/api/v1/workflows',
    {
      schema: {
        tags: ['Workflow API'],
        summary: 'List available workflows',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            stepsCount: z.number(),
            steps: z.array(z.object({
              id: z.string(),
              name: z.string(),
              stepOrder: z.number(),
            })),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const workflows = await prisma.workflow.findMany({
        where: { userId },
        include: {
          steps: {
            select: { id: true, name: true, stepOrder: true },
            orderBy: { stepOrder: 'asc' },
          },
          _count: { select: { steps: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        type: w.type,
        stepsCount: w._count.steps,
        steps: w.steps,
      }))
    },
  )
}
