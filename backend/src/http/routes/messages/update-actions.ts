import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updateMessageActions(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
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
      const { id } = request.params
      const { actions } = request.body

      const message = await prisma.message.findUnique({ where: { id } })
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      const currentMetadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {})

      await prisma.message.update({
        where: { id },
        data: {
          metadata: JSON.stringify({
            ...currentMetadata,
            actions,
          }),
        },
      })

      return {
        id,
        success: true,
      }
    }
  )
}
