import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteMessage(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
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
      const { id } = request.params

      const message = await prisma.message.findUnique({ where: { id } })
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      await prisma.message.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
