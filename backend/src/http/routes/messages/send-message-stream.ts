import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { taskOrchestrator } from '../../../services/orchestrator/task-orchestrator.js'
import { orchestratorEvents } from '../../../services/orchestrator/events.js'
import { NotFoundError } from '../_errors/index.js'

// Attachment schema for request body
const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  path: z.string(),
  projectPath: z.string(),
  url: z.string(),
  size: z.number().optional(),
})

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
          content: z.string(), // Allow empty string when attachments are present
          stepIndex: z.number().optional(),
          attachments: z.array(attachmentSchema).optional(),
        }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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

      // Check if already executing — if so, force-cancel the stale execution
      // This prevents the user from getting permanently stuck
      if (taskOrchestrator.isExecuting(id)) {
        console.log(`[sendMessageStream] Stale execution detected for ${id}, force-cancelling`)
        taskOrchestrator.cancel(id)
        // Give the process a moment to die
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
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

      // Event handlers - FILTER ALL by conversationId to prevent cross-talk between sessions
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
        'execution:cancelled': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('cancelled', data)
        },
        'execution:complete': (data: unknown) => {
          if (filterByConversation(data)) sendEvent('complete', data)
        },
      }

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        orchestratorEvents.on(event, handler)
      })

      // Cleanup on close
      let clientDisconnected = false
      const cleanup = () => {
        Object.entries(handlers).forEach(([event, handler]) => {
          orchestratorEvents.off(event, handler)
        })
      }
      request.raw.on('close', () => {
        clientDisconnected = true
        cleanup()
        // Client disconnected (e.g. cancel button) — kill any running process
        // so it doesn't keep running orphaned in the background
        if (taskOrchestrator.isExecuting(id)) {
          console.log(`[SSE] Client disconnected for ${id}, cancelling execution`)
          taskOrchestrator.cancel(id)
        }
      })

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
          attachments,
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
