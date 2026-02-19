import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updateRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Update rule',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          body: z.string().optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
          skillId: z.string().nullable().optional(),
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
      const { name, description, body, enabled, isGlobal, skillId } = request.body

      const existing = await prisma.rule.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Rule not found')

      const rule = await prisma.rule.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(body !== undefined && { body }),
          ...(enabled !== undefined && { enabled }),
          ...(isGlobal !== undefined && { isGlobal }),
          ...(skillId !== undefined && { skillId }),
        },
      })

      return {
        id: rule.id,
        name: rule.name,
        updatedAt: rule.updatedAt.toISOString(),
      }
    }
  )
}
