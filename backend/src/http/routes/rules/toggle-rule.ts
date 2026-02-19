import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function toggleRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/rules/:id/toggle',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Toggle rule enabled state',
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

      const existing = await prisma.rule.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Rule not found')

      const rule = await prisma.rule.update({
        where: { id },
        data: { enabled: !existing.enabled },
      })

      return { id: rule.id, enabled: rule.enabled }
    }
  )
}
