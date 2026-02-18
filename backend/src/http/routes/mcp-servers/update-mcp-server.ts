import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updateMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Update MCP server',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          type: z.enum(['http', 'sse', 'stdio']).optional(),
          uri: z.string().optional(),
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          envVars: z.record(z.string()).optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { name, description, type, uri, command, args, envVars, enabled, isGlobal } = request.body

      const existing = await prisma.mcpServer.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('MCP Server not found')

      const server = await prisma.mcpServer.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type }),
          ...(uri !== undefined && { uri }),
          ...(command !== undefined && { command }),
          ...(args !== undefined && { args: JSON.stringify(args) }),
          ...(envVars !== undefined && { envVars: JSON.stringify(envVars) }),
          ...(enabled !== undefined && { enabled }),
          ...(isGlobal !== undefined && { isGlobal }),
        },
      })

      return {
        id: server.id,
        name: server.name,
        type: server.type,
        updatedAt: server.updatedAt.toISOString(),
      }
    }
  )
}
