import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function toggleSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/skills/:id/toggle',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Toggle skill enabled state',
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

      const existing = await prisma.skill.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Skill not found')

      const skill = await prisma.skill.update({
        where: { id },
        data: { enabled: !existing.enabled },
      })

      return { id: skill.id, enabled: skill.enabled }
    }
  )
}
