import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updatePlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Update plugin metadata',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          version: z.string().nullable().optional(),
          author: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
          projectPath: z.string().nullable().optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { name, description, version, author, enabled, projectPath } = request.body

      const existing = await prisma.plugin.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Plugin not found')

      const plugin = await prisma.plugin.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(version !== undefined && { version }),
          ...(author !== undefined && { author }),
          ...(enabled !== undefined && { enabled }),
          ...(projectPath !== undefined && { projectPath }),
        },
      })

      return {
        id: plugin.id,
        name: plugin.name,
        updatedAt: plugin.updatedAt.toISOString(),
      }
    }
  )
}
