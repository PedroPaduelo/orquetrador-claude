import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Delete rule',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.rule.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Rule not found')

      await prisma.rule.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
