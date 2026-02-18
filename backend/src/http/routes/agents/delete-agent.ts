import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Delete agent',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.agent.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Agent not found')

      await prisma.agent.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
