import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listSkills(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/skills',
    {
      schema: {
        tags: ['Skills'],
        summary: 'List all skills',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            allowedTools: z.array(z.string()),
            model: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            repoOwner: z.string().nullable(),
            repoName: z.string().nullable(),
            repoBranch: z.string().nullable(),
            repoPath: z.string().nullable(),
            lastSyncedAt: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const skills = await prisma.skill.findMany({ orderBy: { createdAt: 'desc' } })
      return skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        allowedTools: JSON.parse(s.allowedTools || '[]'),
        model: s.model,
        enabled: s.enabled,
        isGlobal: s.isGlobal,
        pluginId: s.pluginId,
        source: s.source,
        repoUrl: s.repoUrl,
        repoOwner: s.repoOwner,
        repoName: s.repoName,
        repoBranch: s.repoBranch,
        repoPath: s.repoPath,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }))
    }
  )
}
