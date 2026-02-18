import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Get agent by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            systemPrompt: z.string(),
            tools: z.array(z.string()),
            disallowedTools: z.array(z.string()),
            model: z.string().nullable(),
            permissionMode: z.string(),
            maxTurns: z.number().nullable(),
            skills: z.array(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const agent = await prisma.agent.findUnique({ where: { id } })
      if (!agent) throw new NotFoundError('Agent not found')

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        tools: JSON.parse(agent.tools || '[]'),
        disallowedTools: JSON.parse(agent.disallowedTools || '[]'),
        model: agent.model,
        permissionMode: agent.permissionMode,
        maxTurns: agent.maxTurns,
        skills: JSON.parse(agent.skills || '[]'),
        enabled: agent.enabled,
        isGlobal: agent.isGlobal,
        pluginId: agent.pluginId,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      }
    }
  )
}
