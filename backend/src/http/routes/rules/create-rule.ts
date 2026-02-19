import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function createRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/rules',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Create a new rule',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          body: z.string().default(''),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
          skillId: z.string().nullable().optional(),
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
      const { name, description, body, enabled, isGlobal, skillId } = request.body

      const rule = await prisma.rule.create({
        data: {
          name,
          description,
          body,
          enabled,
          isGlobal,
          skillId: skillId ?? null,
        },
      })

      return reply.status(201).send({
        id: rule.id,
        name: rule.name,
        createdAt: rule.createdAt.toISOString(),
      })
    }
  )
}
