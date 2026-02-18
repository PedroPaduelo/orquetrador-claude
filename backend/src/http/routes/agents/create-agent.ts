import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function createAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/agents',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Create a new agent',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          systemPrompt: z.string().default(''),
          tools: z.array(z.string()).default([]),
          disallowedTools: z.array(z.string()).default([]),
          model: z.string().optional(),
          permissionMode: z.string().default('default'),
          maxTurns: z.number().optional(),
          skills: z.array(z.string()).default([]),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, description, systemPrompt, tools, disallowedTools, model, permissionMode, maxTurns, skills, enabled, isGlobal } = request.body

      const agent = await prisma.agent.create({
        data: {
          name,
          description,
          systemPrompt,
          tools: JSON.stringify(tools),
          disallowedTools: JSON.stringify(disallowedTools),
          model,
          permissionMode,
          maxTurns,
          skills: JSON.stringify(skills),
          enabled,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt.toISOString(),
      })
    }
  )
}
