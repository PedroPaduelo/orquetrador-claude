import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updateAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Update agent',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          tools: z.array(z.string()).optional(),
          disallowedTools: z.array(z.string()).optional(),
          model: z.string().nullable().optional(),
          permissionMode: z.string().optional(),
          maxTurns: z.number().nullable().optional(),
          skills: z.array(z.string()).optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
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
      const { name, description, systemPrompt, tools, disallowedTools, model, permissionMode, maxTurns, skills, enabled, isGlobal } = request.body

      const existing = await prisma.agent.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Agent not found')

      const agent = await prisma.agent.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(tools !== undefined && { tools: JSON.stringify(tools) }),
          ...(disallowedTools !== undefined && { disallowedTools: JSON.stringify(disallowedTools) }),
          ...(model !== undefined && { model }),
          ...(permissionMode !== undefined && { permissionMode }),
          ...(maxTurns !== undefined && { maxTurns }),
          ...(skills !== undefined && { skills: JSON.stringify(skills) }),
          ...(enabled !== undefined && { enabled }),
          ...(isGlobal !== undefined && { isGlobal }),
        },
      })

      return {
        id: agent.id,
        name: agent.name,
        updatedAt: agent.updatedAt.toISOString(),
      }
    }
  )
}
