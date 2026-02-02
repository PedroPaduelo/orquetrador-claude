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
      })

      // Helper to send SSE events
      const sendEvent = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\n`)
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Event handlers
      const handlers: Record<string, (...args: unknown[]) => void> = {
        'step:start': (data) => sendEvent('step_start', data),
        'step:stream': (data) => sendEvent('stream', data),
        'step:complete': (data) => sendEvent('step_complete', data),
        'step:error': (data) => sendEvent('step_error', data),
        'message:saved': (data) => sendEvent('message_saved', data),
        'condition:retry': (data) => sendEvent('condition_retry', data),
        'condition:jump': (data) => sendEvent('condition_jump', data),
        'execution:cancelled': () => sendEvent('cancelled', {}),
        'execution:complete': (data) => sendEvent('complete', data),
      }

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      // Cleanup on close
      request.raw.on('close', () => {
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      })

      try {
        const context = {
          conversationId: id,
          workflowId: conversation.workflowId,
          steps: conversation.workflow.steps,
          projectPath: conversation.workflow.projectPath || process.cwd(),
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
        // Cleanup handlers
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
        reply.raw.end()
      }
    }
  )
}
