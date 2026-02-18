import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function updateSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Update skill',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          body: z.string().optional(),
          allowedTools: z.array(z.string()).optional(),
          model: z.string().nullable().optional(),
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
      const { name, description, body, allowedTools, model, enabled, isGlobal } = request.body

      const existing = await prisma.skill.findUnique({ where: { id } })
      if (!existing) throw new NotFoundError('Skill not found')

      const skill = await prisma.skill.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(body !== undefined && { body }),
          ...(allowedTools !== undefined && { allowedTools: JSON.stringify(allowedTools) }),
          ...(model !== undefined && { model }),
          ...(enabled !== undefined && { enabled }),
          ...(isGlobal !== undefined && { isGlobal }),
        },
      })

      return {
        id: skill.id,
        name: skill.name,
        updatedAt: skill.updatedAt.toISOString(),
      }
    }
  )
}
