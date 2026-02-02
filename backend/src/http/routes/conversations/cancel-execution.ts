import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { taskOrchestrator } from '../../../services/orchestrator/task-orchestrator.js'
import { NotFoundError, BadRequestError } from '../_errors/index.js'
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

      if (!taskOrchestrator.isExecuting(id)) {
        throw new BadRequestError('No active execution to cancel')
      }

      const cancelled = taskOrchestrator.cancel(id)

      return {
        success: cancelled,
        message: cancelled ? 'Execution cancelled' : 'Failed to cancel execution',
      }
    }
  )
}
