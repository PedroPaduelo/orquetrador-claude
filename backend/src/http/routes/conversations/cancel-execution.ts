import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { taskOrchestrator } from '../../../services/orchestrator/task-orchestrator.js'
import { NotFoundError } from '../_errors/index.js'
import { prisma } from '../../../lib/prisma.js'

export async function cancelExecution(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/conversations/:id/cancel',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Cancel active execution',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const conversation = await prisma.conversation.findUnique({ where: { id } })
      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      // Always try to cancel — don't check isExecuting first.
      // The process may still be running even if the orchestrator
      // doesn't think it's "executing" (race conditions, SSE disconnect, etc.)
      const cancelled = taskOrchestrator.cancel(id)

      return {
        success: true,
        message: cancelled ? 'Execution cancelled' : 'No active process found, state cleared',
      }
    }
  )
}
