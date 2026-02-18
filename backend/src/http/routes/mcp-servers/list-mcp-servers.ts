import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listMcpServers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/mcp-servers',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'List all MCP servers',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            uri: z.string().nullable(),
            command: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            lastTestAt: z.string().nullable(),
            lastTestOk: z.boolean().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const servers = await prisma.mcpServer.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return servers.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        uri: s.uri,
        command: s.command,
        enabled: s.enabled,
        isGlobal: s.isGlobal,
        lastTestAt: s.lastTestAt?.toISOString() ?? null,
        lastTestOk: s.lastTestOk,
        pluginId: s.pluginId,
        createdAt: s.createdAt.toISOString(),
      }))
    }
  )
}
