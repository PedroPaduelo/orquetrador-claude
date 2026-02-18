import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

function safeParseArray(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'string') return parsed.split(',').map((s) => s.trim()).filter(Boolean)
    return []
  } catch {
    // Not JSON — might be comma-separated string
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

export async function listAgents(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/agents',
    {
      schema: {
        tags: ['Agents'],
        summary: 'List all agents',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            model: z.string().nullable(),
            permissionMode: z.string(),
            maxTurns: z.number().nullable(),
            tools: z.array(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'desc' } })
      return agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        model: a.model,
        permissionMode: a.permissionMode,
        maxTurns: a.maxTurns,
        tools: safeParseArray(a.tools),
        enabled: a.enabled,
        isGlobal: a.isGlobal,
        pluginId: a.pluginId,
        source: a.source,
        repoUrl: a.repoUrl,
        createdAt: a.createdAt.toISOString(),
      }))
    }
  )
}
