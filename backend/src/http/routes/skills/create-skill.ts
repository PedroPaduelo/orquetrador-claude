import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function createSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/skills',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Create a new skill',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          body: z.string().default(''),
          allowedTools: z.array(z.string()).default([]),
          model: z.string().optional(),
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
      const { name, description, body, allowedTools, model, enabled, isGlobal } = request.body

      const skill = await prisma.skill.create({
        data: {
          name,
          description,
          body,
          allowedTools: JSON.stringify(allowedTools),
          model,
          enabled,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: skill.id,
        name: skill.name,
        createdAt: skill.createdAt.toISOString(),
      })
    }
  )
}
