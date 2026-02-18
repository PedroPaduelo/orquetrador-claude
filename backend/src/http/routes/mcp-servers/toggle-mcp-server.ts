import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function toggleMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/mcp-servers/:id/toggle',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Toggle MCP server enabled state',
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

      const existing = await prisma.mcpServer.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('MCP Server not found')

      const server = await prisma.mcpServer.update({
        where: { id },
        data: { enabled: !existing.enabled },
      })

      return {
        id: server.id,
        enabled: server.enabled,
      }
    }
  )
}
