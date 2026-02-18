import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Get MCP server by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            uri: z.string().nullable(),
            command: z.string().nullable(),
            args: z.array(z.string()),
            envVars: z.record(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            toolsCache: z.unknown().nullable(),
            lastTestAt: z.string().nullable(),
            lastTestOk: z.boolean().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const server = await prisma.mcpServer.findUnique({ where: { id } })
      if (!server) throw new NotFoundError('MCP Server not found')

      let toolsCache = null
      if (server.toolsCache) {
        try { toolsCache = JSON.parse(server.toolsCache) } catch { /* ignore */ }
      }

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        type: server.type,
        uri: server.uri,
        command: server.command,
        args: JSON.parse(server.args || '[]'),
        envVars: JSON.parse(server.envVars || '{}'),
        enabled: server.enabled,
        isGlobal: server.isGlobal,
        toolsCache,
        lastTestAt: server.lastTestAt?.toISOString() ?? null,
        lastTestOk: server.lastTestOk,
        pluginId: server.pluginId,
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
      }
    }
  )
}
