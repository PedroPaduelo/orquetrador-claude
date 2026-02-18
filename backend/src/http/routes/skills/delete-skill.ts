import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Delete skill',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.skill.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Skill not found')

      await prisma.skill.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
