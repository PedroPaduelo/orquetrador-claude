import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function createMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/mcp-servers',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Create a new MCP server',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(['http', 'sse', 'stdio']).default('http'),
          uri: z.string().optional(),
          command: z.string().optional(),
          args: z.array(z.string()).default([]),
          envVars: z.record(z.string()).default({}),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, description, type, uri, command, args, envVars, enabled, isGlobal } = request.body

      const server = await prisma.mcpServer.create({
        data: {
          name,
          description,
          type,
          uri,
          command,
          args: JSON.stringify(args),
          envVars: JSON.stringify(envVars),
          enabled,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: server.id,
        name: server.name,
        type: server.type,
        createdAt: server.createdAt.toISOString(),
      })
    }
  )
}
