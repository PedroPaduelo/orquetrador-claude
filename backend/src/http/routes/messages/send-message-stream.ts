import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { taskOrchestrator } from '../../../services/orchestrator/task-orchestrator.js'
import { orchestratorEvents } from '../../../services/orchestrator/events.js'
import { NotFoundError, ConflictError } from '../_errors/index.js'

export async function sendMessageStream(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/conversations/:id/messages/stream',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Send message and receive SSE stream',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          content: z.string().min(1),
          stepIndex: z.number().optional(),
        }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const { content, stepIndex } = request.body as { content: string; stepIndex?: number }

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

      // Check if already executing
      if (taskOrchestrator.isExecuting(id)) {
        throw new ConflictError('Execution already in progress')
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      })

      // Helper to send SSE events
      const sendEvent = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`)
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch {
          // Connection may have closed
        }
      }

      // Event handlers - FILTER by conversationId to prevent cross-talk
      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (data: unknown) => {
          const d = data as { conversationId?: string }
          if (d.conversationId === id) sendEvent('step_start', data)
        },
        'step:stream': (data: unknown) => {
          // step:stream events don't have conversationId directly,
          // but are tied to an execution which is per-conversation
          sendEvent('stream', data)
        },
        'step:complete': (data: unknown) => {
          sendEvent('step_complete', data)
        },
        'step:error': (data: unknown) => {
          sendEvent('step_error', data)
        },
        'message:saved': (data: unknown) => {
          sendEvent('message_saved', data)
        },
        'condition:retry': (data: unknown) => {
          sendEvent('condition_retry', data)
        },
        'condition:jump': (data: unknown) => {
          sendEvent('condition_jump', data)
        },
        'execution:cancelled': (data: unknown) => {
          const d = data as { conversationId?: string }
          if (d.conversationId === id) sendEvent('cancelled', data)
        },
        'execution:complete': (data: unknown) => {
          const d = data as { conversationId?: string }
          if (d.conversationId === id) sendEvent('complete', data)
        },
      }

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      // Cleanup on close
      const cleanup = () => {
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      }
      request.raw.on('close', cleanup)

      try {
        const projectPath = conversation.workflow.projectPath
        if (!projectPath) {
          sendEvent('error', {
            message: 'Workflow nao tem projectPath configurado. Configure o caminho do projeto no workflow.',
          })
          return
        }

        const context = {
          conversationId: id,
          workflowId: conversation.workflowId,
          steps: conversation.workflow.steps,
          projectPath,
        }

        if (conversation.workflow.type === 'sequential') {
          await taskOrchestrator.executeSequential(context, content)
        } else {
          // step_by_step mode
          const currentIndex = stepIndex ?? (
            conversation.currentStepId
              ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
              : 0
          )
          await taskOrchestrator.executeStepByStep(context, content, Math.max(0, currentIndex))
        }
      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        cleanup()
        reply.raw.end()
      }
    }
  )
}
