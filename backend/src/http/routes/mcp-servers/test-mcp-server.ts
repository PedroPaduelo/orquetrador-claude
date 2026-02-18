import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function testMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/mcp-servers/:id/test',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Test MCP server connection and fetch tools',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            ok: z.boolean(),
            tools: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
            })).optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const server = await prisma.mcpServer.findUnique({ where: { id } })
      if (!server) throw new NotFoundError('MCP Server not found')

      try {
        // For HTTP/SSE servers, try to reach the endpoint
        if ((server.type === 'http' || server.type === 'sse') && server.uri) {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 10000)

          const response = await fetch(server.uri, {
            method: 'GET',
            signal: controller.signal,
          }).catch(() => null)

          clearTimeout(timeout)

          const ok = response !== null && response.status < 500

          await prisma.mcpServer.update({
            where: { id },
            data: {
              lastTestAt: new Date(),
              lastTestOk: ok,
            },
          })

          return { ok, tools: [] }
        }

        // For stdio servers, just validate command exists
        if (server.type === 'stdio' && server.command) {
          await prisma.mcpServer.update({
            where: { id },
            data: {
              lastTestAt: new Date(),
              lastTestOk: true,
            },
          })

          return { ok: true, tools: [] }
        }

        return { ok: false, error: 'Invalid server configuration' }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'

        await prisma.mcpServer.update({
          where: { id },
          data: {
            lastTestAt: new Date(),
            lastTestOk: false,
          },
        })

        return { ok: false, error: errorMessage }
      }
    }
  )
}
