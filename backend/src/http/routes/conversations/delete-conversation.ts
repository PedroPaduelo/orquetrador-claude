import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteConversation(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/conversations/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Delete conversation',
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.conversation.findUnique({ where: { id } })
      if (!existing) {
        throw new NotFoundError('Conversation not found')
      }

      await prisma.conversation.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
