import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deletePlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Uninstall a plugin (cascade deletes children)',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.plugin.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Plugin not found')

      // Delete child entities first (cascade via Prisma relations sets pluginId to null, so we delete manually)
      await prisma.mcpServer.deleteMany({ where: { pluginId: id } })
      await prisma.skill.deleteMany({ where: { pluginId: id } })
      await prisma.agent.deleteMany({ where: { pluginId: id } })
      await prisma.plugin.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
