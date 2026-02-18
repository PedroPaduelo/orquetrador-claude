import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function togglePlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/plugins/:id/toggle',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Toggle plugin enabled state (cascades to children)',
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

      const existing = await prisma.plugin.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Plugin not found')

      const newEnabled = !existing.enabled

      // Toggle plugin and cascade to children
      const [plugin] = await prisma.$transaction([
        prisma.plugin.update({
          where: { id },
          data: { enabled: newEnabled },
        }),
        prisma.mcpServer.updateMany({
          where: { pluginId: id },
          data: { enabled: newEnabled },
        }),
        prisma.skill.updateMany({
          where: { pluginId: id },
          data: { enabled: newEnabled },
        }),
        prisma.agent.updateMany({
          where: { pluginId: id },
          data: { enabled: newEnabled },
        }),
      ])

      return { id: plugin.id, enabled: plugin.enabled }
    }
  )
}
