import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { requireRole } from '../../../middlewares/rbac.js'

export async function hourlyTokenUsageRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/admin/token-usage/hourly', {
    schema: {
      tags: ['Admin', 'Observability'],
      summary: 'Listar uso de tokens por hora (admin)',
      querystring: z.object({
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        userId: z.string().uuid().optional(),
        model: z.string().optional(),
      }),
      response: {
        200: z.array(z.object({
          id: z.string(),
          hour: z.string(),
          tokens: z.number(),
          costUsd: z.number(),
          model: z.string().nullable(),
          userId: z.string(),
          createdAt: z.string(),
        })),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const { from, to, userId, model } = request.query

    const where: Record<string, unknown> = {}
    if (from || to) {
      where.hour = {}
      if (from) (where.hour as Record<string, unknown>).gte = new Date(from)
      if (to) (where.hour as Record<string, unknown>).lte = new Date(to)
    }
    if (userId) where.userId = userId
    if (model) where.model = model

    const records = await prisma.hourlyTokenUsage.findMany({
      where,
      orderBy: { hour: 'desc' },
      take: 500,
    })

    return records.map(r => ({
      id: r.id,
      hour: r.hour.toISOString(),
      tokens: r.tokens,
      costUsd: r.costUsd,
      model: r.model,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }))
  })
}
