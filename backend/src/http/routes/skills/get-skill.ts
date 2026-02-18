import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Get skill by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            body: z.string(),
            allowedTools: z.array(z.string()),
            model: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const skill = await prisma.skill.findUnique({ where: { id } })
      if (!skill) throw new NotFoundError('Skill not found')

      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        body: skill.body,
        allowedTools: JSON.parse(skill.allowedTools || '[]'),
        model: skill.model,
        enabled: skill.enabled,
        isGlobal: skill.isGlobal,
        pluginId: skill.pluginId,
        createdAt: skill.createdAt.toISOString(),
        updatedAt: skill.updatedAt.toISOString(),
      }
    }
  )
}
