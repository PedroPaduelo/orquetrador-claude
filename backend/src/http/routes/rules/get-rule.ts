import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Get rule by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            body: z.string(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            skillId: z.string().nullable(),
            skillName: z.string().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const rule = await prisma.rule.findUnique({
        where: { id },
        include: { skill: { select: { name: true } } },
      })
      if (!rule) throw new NotFoundError('Rule not found')

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        body: rule.body,
        enabled: rule.enabled,
        isGlobal: rule.isGlobal,
        source: rule.source,
        repoUrl: rule.repoUrl,
        skillId: rule.skillId,
        skillName: rule.skill?.name ?? null,
        pluginId: rule.pluginId,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      }
    }
  )
}
