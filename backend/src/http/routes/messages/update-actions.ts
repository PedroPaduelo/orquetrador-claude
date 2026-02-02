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

      const currentMetadata = (message.metadata as Record<string, unknown>) || {}

      await prisma.message.update({
        where: { id },
        data: {
          metadata: {
            ...currentMetadata,
            actions: actions as object[],
          },
        },
      })

      return {
        id,
        success: true,
      }
    }
  )
}
