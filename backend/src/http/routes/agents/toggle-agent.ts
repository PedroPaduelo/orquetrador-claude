import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function toggleAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/agents/:id/toggle',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Toggle agent enabled state',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            enabled: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const existing = await prisma.agent.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Agent not found')

      const agent = await prisma.agent.update({
        where: { id },
        data: { enabled: !existing.enabled },
      })

      return { id: agent.id, enabled: agent.enabled }
    }
  )
}
