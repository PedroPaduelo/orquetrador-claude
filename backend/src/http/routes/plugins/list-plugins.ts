import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listPlugins(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/plugins',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'List all plugins',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            version: z.string().nullable(),
            author: z.string().nullable(),
            enabled: z.boolean(),
            mcpServersCount: z.number(),
            skillsCount: z.number(),
            agentsCount: z.number(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const plugins = await prisma.plugin.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { mcpServers: true, skills: true, agents: true },
          },
        },
      })

      return plugins.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        version: p.version,
        author: p.author,
        enabled: p.enabled,
        mcpServersCount: p._count.mcpServers,
        skillsCount: p._count.skills,
        agentsCount: p._count.agents,
        createdAt: p.createdAt.toISOString(),
      }))
    }
  )
}
