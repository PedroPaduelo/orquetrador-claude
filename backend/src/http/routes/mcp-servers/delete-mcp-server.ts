import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Delete MCP server',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.mcpServer.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('MCP Server not found')

      await prisma.mcpServer.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
