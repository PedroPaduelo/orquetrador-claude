import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { taskOrchestrator } from './orchestrator/task-orchestrator.js'
import { orchestratorEvents } from './orchestrator/events.js'
import { messagesRepository } from './messages.repository.js'
import { NotFoundError, BadRequestError } from '../../http/errors/index.js'
import { validateProjectPath } from '../../lib/validation.js'
import { projectPathLock } from './lock/project-path-lock.js'
import { tokenBudgetService } from './budget/token-budget-service.js'
import { isDAGWorkflow } from './orchestrator/dag-executor.js'
import { executionStateManager } from './orchestrator/execution-state.js'

const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  path: z.string(),
  projectPath: z.string(),
  url: z.string(),
  size: z.number().optional(),
})

export async function executionRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /conversations/:id/messages/stream - SSE streaming endpoint
  server.post(
    '/conversations/:id/messages/stream',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Send message and receive SSE stream',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          content: z.string(),
          stepIndex: z.number().optional(),
          attachments: z.array(attachmentSchema).optional(),
        }),
        // No response schema — raw SSE response
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = await request.getCurrentUserId()
      const { id } = request.params as { id: string }
      const { content, stepIndex, attachments } = request.body as {
        content: string
        stepIndex?: number
        attachments?: z.infer<typeof attachmentSchema>[]
      }

      // Fetch conversation with workflow and steps
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          workflow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
        },
      })

      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      // Budget check
      const budgetCheck = await tokenBudgetService.checkBudget(userId)
      if (!budgetCheck.allowed) {
        return reply.status(429).send({ message: budgetCheck.reason })
      }

      // Path validation
      if (conversation.projectPath) {
        validateProjectPath(conversation.projectPath)
      }

      // Lock check removed — allow multiple chats on the same project path

      // If a stale execution is running, force-cancel it before proceeding
      if (taskOrchestrator.isExecuting(id)) {
        console.log(`[executionRoutes] Stale execution detected for ${id}, force-cancelling`)
        taskOrchestrator.cancel(id)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'X-Accel-Buffering': 'no',
      })

      // Helper to write SSE events
      const sendEvent = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`)
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch {
          // Connection may have already closed
        }
      }

      // Heartbeat to keep SSE alive through proxies and prevent idle timeouts
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`:heartbeat\n\n`)
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      // Filter events to only pass through those belonging to this conversation
      const filterByConversation = (data: unknown): boolean => {
        const d = data as { conversationId?: string }
        return d.conversationId === id
      }

      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('step_start', data)
        },
        'step:stream': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('stream', data)
        },
        'step:complete': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('step_complete', data)
        },
        'step:error': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('step_error', data)
        },
        'message:saved': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('message_saved', data)
        },
        'condition:retry': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('condition_retry', data)
        },
        'condition:jump': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('condition_jump', data)
        },
        'context:reset': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('context_reset', data)
        },
        'execution:cancelled': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('cancelled', data)
        },
        'execution:complete': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('complete', data)
        },
        'dag:batch_start': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('dag_batch_start', data)
        },
        'validation:failed': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('validation_failed', data)
        },
        'execution:paused': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('execution_paused', data)
        },
        'execution:resumed': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('execution_resumed', data)
        },
        'user:interrupt': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('user_interrupt', data)
        },
      }

      // Register all event listeners
      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      // Cleanup helper — removes all registered listeners
      const cleanup = () => {
        clearInterval(heartbeat)
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      }

      // On client disconnect: cleanup and cancel any running execution
      request.raw.on('close', () => {
        cleanup()
        if (taskOrchestrator.isExecuting(id)) {
          console.log(`[SSE] Client disconnected for ${id}, cancelling execution`)
          taskOrchestrator.cancel(id)
        }
      })

      let releaseLock: (() => void) | null = null
      try {
        const projectPath = conversation.projectPath
        if (!projectPath) {
          sendEvent('error', {
            message: 'Conversa nao tem projectPath configurado. Defina a pasta do projeto ao criar a conversa.',
          })
          return
        }

        // Acquire lock for project path
        releaseLock = await projectPathLock.acquire(projectPath)

        const context = {
          conversationId: id,
          workflowId: conversation.workflowId,
          steps: conversation.workflow.steps,
          projectPath,
          attachments,
          userId,
        }

        // Check if there's a paused execution to resume
        const pausedExecution = await taskOrchestrator.getPausedExecution(id)
        if (pausedExecution) {
          // User is responding to a paused execution — resume it
          console.log(`[executionRoutes] Resuming paused execution ${pausedExecution.executionId} for conversation ${id} at step ${pausedExecution.stepIndex}`)
          await taskOrchestrator.resumeExecution(context, content, pausedExecution)
        } else if (conversation.workflow.type === 'sequential' && isDAGWorkflow(conversation.workflow.steps)) {
          await taskOrchestrator.executeDAG(context, content)
        } else if (conversation.workflow.type === 'sequential') {
          await taskOrchestrator.executeSequential(context, content)
        } else {
          // step_by_step mode
          const currentIndex =
            stepIndex ??
            (conversation.currentStepId
              ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
              : 0)
          await taskOrchestrator.executeStepByStep(context, content, Math.max(0, currentIndex))
        }
      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        if (releaseLock) releaseLock()
        cleanup()
        reply.raw.end()
      }
    }
  )

  // POST /conversations/:id/interrupt - send user message mid-execution
  server.post(
    '/conversations/:id/interrupt',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Interrupt running execution with user message',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          content: z.string().min(1),
        }),
        response: {
          200: z.object({ interrupted: z.boolean() }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params as { id: string }
      const { content } = request.body as { content: string }

      if (!taskOrchestrator.isExecuting(id)) {
        throw new BadRequestError('No active execution for this conversation')
      }

      const interrupted = taskOrchestrator.interruptExecution(id, content)
      return { interrupted }
    }
  )

  // GET /conversations/:id/execution-status - check if there's an active execution
  server.get(
    '/conversations/:id/execution-status',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Get current execution status for a conversation',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            active: z.boolean(),
            state: z.string().nullable(),
            stepIndex: z.number().nullable(),
            paused: z.boolean(),
            pausedInfo: z.unknown().nullable(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params as { id: string }

      // Check in-memory first (most reliable for "is running right now")
      const isRunning = taskOrchestrator.isExecuting(id)

      if (isRunning) {
        const dbState = await executionStateManager.getByConversation(id)
        return {
          active: true,
          state: 'running',
          stepIndex: dbState?.currentStepIndex ?? null,
          paused: false,
          pausedInfo: null,
        }
      }

      // Check for paused execution
      const paused = await taskOrchestrator.getPausedExecution(id)
      if (paused) {
        return {
          active: true,
          state: 'paused',
          stepIndex: paused.stepIndex,
          paused: true,
          pausedInfo: {
            executionId: paused.executionId,
            stepId: paused.stepId,
            resumeToken: paused.resumeToken,
            askUserQuestion: paused.askUserQuestion,
          },
        }
      }

      return { active: false, state: null, stepIndex: null, paused: false, pausedInfo: null }
    }
  )

  // GET /conversations/:id/watch - SSE stream to observe an active execution without starting one
  server.get(
    '/conversations/:id/watch',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Watch an active execution via SSE (read-only)',
        params: z.object({ id: z.string() }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await request.getCurrentUserId()
      const { id } = request.params as { id: string }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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

      const filterByConversation = (data: unknown): boolean => {
        const d = data as { conversationId?: string }
        return d.conversationId === id
      }

      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (data: unknown) => { if (filterByConversation(data)) sendEvent('step_start', data) },
        'step:stream': (data: unknown) => { if (filterByConversation(data)) sendEvent('stream', data) },
        'step:complete': (data: unknown) => { if (filterByConversation(data)) sendEvent('step_complete', data) },
        'step:error': (data: unknown) => { if (filterByConversation(data)) sendEvent('step_error', data) },
        'message:saved': (data: unknown) => { if (filterByConversation(data)) sendEvent('message_saved', data) },
        'condition:retry': (data: unknown) => { if (filterByConversation(data)) sendEvent('condition_retry', data) },
        'condition:jump': (data: unknown) => { if (filterByConversation(data)) sendEvent('condition_jump', data) },
        'context:reset': (data: unknown) => { if (filterByConversation(data)) sendEvent('context_reset', data) },
        'execution:cancelled': (data: unknown) => { if (filterByConversation(data)) sendEvent('cancelled', data) },
        'execution:complete': (data: unknown) => {
          if (filterByConversation(data)) {
            sendEvent('complete', data)
            cleanup()
            reply.raw.end()
          }
        },
        'dag:batch_start': (data: unknown) => { if (filterByConversation(data)) sendEvent('dag_batch_start', data) },
        'validation:failed': (data: unknown) => { if (filterByConversation(data)) sendEvent('validation_failed', data) },
        'execution:paused': (data: unknown) => { if (filterByConversation(data)) sendEvent('execution_paused', data) },
        'execution:resumed': (data: unknown) => { if (filterByConversation(data)) sendEvent('execution_resumed', data) },
        'user:interrupt': (data: unknown) => { if (filterByConversation(data)) sendEvent('user_interrupt', data) },
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

      // If no execution is active, close immediately
      if (!taskOrchestrator.isExecuting(id)) {
        sendEvent('no_active_execution', { conversationId: id })
        cleanup()
        reply.raw.end()
      }
    }
  )

  // GET /conversations/:id/messages - list messages with optional stepId filter
  server.get(
    '/conversations/:id/messages',
    {
      schema: {
        tags: ['Messages'],
        summary: 'List conversation messages',
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          stepId: z.string().optional(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              role: z.string(),
              content: z.string(),
              stepId: z.string().nullable(),
              stepName: z.string().nullable(),
              selectedForContext: z.boolean(),
              metadata: z.unknown().nullable(),
              attachments: z
                .array(
                  z.object({
                    id: z.string(),
                    filename: z.string(),
                    mimeType: z.string(),
                    size: z.number(),
                    path: z.string(),
                    projectPath: z.string(),
                    url: z.string(),
                  })
                )
                .optional(),
              createdAt: z.string(),
            })
          ),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params
      const { stepId } = request.query

      const conversation = await prisma.conversation.findUnique({ where: { id } })
      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      return messagesRepository.findByConversation(id, stepId)
    }
  )

  // PUT /messages/:id/select - toggle message context selection
  server.put(
    '/messages/:id/select',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Toggle message context selection',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          selected: z.boolean(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            selectedForContext: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params
      const { selected } = request.body

      const message = await messagesRepository.findById(id)
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      return messagesRepository.toggleContext(id, selected)
    }
  )

  // PUT /messages/:id/actions - update message actions metadata
  server.put(
    '/messages/:id/actions',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Update message actions metadata',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          actions: z.array(z.unknown()),
        }),
        response: {
          200: z.object({
            id: z.string(),
            success: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params
      const { actions } = request.body

      const message = await messagesRepository.findById(id)
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      return messagesRepository.updateActions(id, actions)
    }
  )

  // GET /conversations/:id/traces - list execution traces for a conversation
  server.get(
    '/conversations/:id/traces',
    {
      schema: {
        tags: ['Messages'],
        summary: 'List execution traces for a conversation',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              executionId: z.string(),
              stepId: z.string(),
              resultStatus: z.string(),
              durationMs: z.number().nullable(),
              contentLength: z.number(),
              actionsCount: z.number(),
              errorMessage: z.string().nullable(),
              createdAt: z.string(),
            })
          ),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params

      const conversation = await prisma.conversation.findUnique({ where: { id } })
      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      const traces = await prisma.executionTrace.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          executionId: true,
          stepId: true,
          resultStatus: true,
          durationMs: true,
          contentLength: true,
          actionsCount: true,
          errorMessage: true,
          createdAt: true,
        },
      })

      return traces.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      }))
    }
  )

  // GET /traces/:traceId - get full trace detail
  server.get(
    '/traces/:traceId',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Get execution trace detail',
        params: z.object({
          traceId: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            executionId: z.string(),
            conversationId: z.string(),
            stepId: z.string(),
            commandLine: z.string(),
            messageLength: z.number(),
            systemPrompt: z.string().nullable(),
            resumeToken: z.string().nullable(),
            model: z.string().nullable(),
            projectPath: z.string(),
            pid: z.number().nullable(),
            stdoutRaw: z.string(),
            stderrRaw: z.string(),
            parsedEvents: z.string(),
            startedAt: z.string(),
            firstByteAt: z.string().nullable(),
            firstContentAt: z.string().nullable(),
            completedAt: z.string().nullable(),
            durationMs: z.number().nullable(),
            exitCode: z.number().nullable(),
            signal: z.string().nullable(),
            resultStatus: z.string(),
            errorMessage: z.string().nullable(),
            contentLength: z.number(),
            actionsCount: z.number(),
            resumeTokenOut: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { traceId } = request.params

      const trace = await prisma.executionTrace.findUnique({
        where: { id: traceId },
      })

      if (!trace) {
        throw new NotFoundError('Trace not found')
      }

      return {
        ...trace,
        startedAt: trace.startedAt.toISOString(),
        firstByteAt: trace.firstByteAt?.toISOString() ?? null,
        firstContentAt: trace.firstContentAt?.toISOString() ?? null,
        completedAt: trace.completedAt?.toISOString() ?? null,
        createdAt: trace.createdAt.toISOString(),
      }
    }
  )

  // DELETE /messages/:id - delete message
  server.delete(
    '/messages/:id',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Delete message',
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const { id } = request.params

      const message = await messagesRepository.findById(id)
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      await messagesRepository.delete(id)

      return reply.status(204).send(null)
    }
  )
}
