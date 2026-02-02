import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { taskOrchestrator } from '../../../services/orchestrator/task-orchestrator.js'
import { NotFoundError } from '../_errors/index.js'

export async function getConversationStatus(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/conversations/:id/status',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get conversation execution status',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            isExecuting: z.boolean(),
            lastExecution: z.object({
              id: z.string(),
              state: z.string(),
              currentStepIndex: z.number(),
              createdAt: z.string(),
            }).nullable(),
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

      const lastExecution = await prisma.executionState.findFirst({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
      })

      return {
        conversationId: id,
        isExecuting: taskOrchestrator.isExecuting(id),
        lastExecution: lastExecution ? {
          id: lastExecution.id,
          state: lastExecution.state,
          currentStepIndex: lastExecution.currentStepIndex,
          createdAt: lastExecution.createdAt.toISOString(),
        } : null,
      }
    }
  )
}
