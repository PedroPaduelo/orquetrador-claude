import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listRules(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/rules',
    {
      schema: {
        tags: ['Rules'],
        summary: 'List all rules',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            repoOwner: z.string().nullable(),
            repoName: z.string().nullable(),
            lastSyncedAt: z.string().nullable(),
            skillId: z.string().nullable(),
            skillName: z.string().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const rules = await prisma.rule.findMany({
        orderBy: { createdAt: 'desc' },
        include: { skill: { select: { name: true } } },
      })
      return rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        enabled: r.enabled,
        isGlobal: r.isGlobal,
        source: r.source,
        repoUrl: r.repoUrl,
        repoOwner: r.repoOwner,
        repoName: r.repoName,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        skillId: r.skillId,
        skillName: r.skill?.name ?? null,
        pluginId: r.pluginId,
        createdAt: r.createdAt.toISOString(),
      }))
    }
  )
}
