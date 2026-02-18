import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getPlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Get plugin by ID with children details',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            version: z.string().nullable(),
            author: z.string().nullable(),
            enabled: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            projectPath: z.string().nullable(),
            mcpServers: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              enabled: z.boolean(),
            })),
            skills: z.array(z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              enabled: z.boolean(),
            })),
            agents: z.array(z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              enabled: z.boolean(),
            })),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const plugin = await prisma.plugin.findUnique({
        where: { id },
        include: {
          mcpServers: { select: { id: true, name: true, type: true, enabled: true } },
          skills: { select: { id: true, name: true, description: true, enabled: true } },
          agents: { select: { id: true, name: true, description: true, enabled: true } },
        },
      })

      if (!plugin) throw new NotFoundError('Plugin not found')

      return {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        author: plugin.author,
        enabled: plugin.enabled,
        source: plugin.source,
        repoUrl: plugin.repoUrl,
        projectPath: plugin.projectPath,
        mcpServers: plugin.mcpServers,
        skills: plugin.skills,
        agents: plugin.agents,
        createdAt: plugin.createdAt.toISOString(),
        updatedAt: plugin.updatedAt.toISOString(),
      }
    }
  )
}
