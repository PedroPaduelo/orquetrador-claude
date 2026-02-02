import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function toggleMessageContext(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/messages/:id/select',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Toggle message context selection',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          selected: z.boolean(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            selectedForContext: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { selected } = request.body

      const message = await prisma.message.findUnique({ where: { id } })
      if (!message) {
        throw new NotFoundError('Message not found')
      }

      const updated = await prisma.message.update({
        where: { id },
        data: { selectedForContext: selected },
      })

      return {
        id: updated.id,
        selectedForContext: updated.selectedForContext,
      }
    }
  )
}
