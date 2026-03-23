import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { requireRole } from '../../../middlewares/rbac.js'

const resourceTypeEnum = z.enum([
  'mcp_server', 'skill', 'agent', 'rule', 'hook', 'plugin', 'workflow',
])

export async function resourcePerformanceRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/admin/resource-performance', {
    schema: {
      tags: ['Admin', 'Observability'],
      summary: 'Metricas de performance de um recurso (admin)',
      querystring: z.object({
        resourceType: resourceTypeEnum,
        resourceId: z.string().uuid(),
        period: z.string().default('daily'),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
      }),
      response: {
        200: z.array(z.object({
          id: z.string(),
          resourceType: z.string(),
          resourceId: z.string(),
          period: z.string(),
          periodStart: z.string(),
          executionCount: z.number(),
          successCount: z.number(),
          avgDurationMs: z.number().nullable(),
          p95DurationMs: z.number().nullable(),
          totalCostUsd: z.number(),
          avgQualityScore: z.number().nullable(),
          createdAt: z.string(),
        })),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const { resourceType, resourceId, period, from, to } = request.query

    const where: Record<string, unknown> = {
      resourceType,
      resourceId,
      period,
    }

    if (from || to) {
      where.periodStart = {}
      if (from) (where.periodStart as Record<string, unknown>).gte = new Date(from)
      if (to) (where.periodStart as Record<string, unknown>).lte = new Date(to)
    }

    const records = await prisma.resourcePerformanceMetric.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: 365,
    })

    return records.map(r => ({
      id: r.id,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      period: r.period,
      periodStart: r.periodStart.toISOString(),
      executionCount: r.executionCount,
      successCount: r.successCount,
      avgDurationMs: r.avgDurationMs,
      p95DurationMs: r.p95DurationMs,
      totalCostUsd: r.totalCostUsd,
      avgQualityScore: r.avgQualityScore,
      createdAt: r.createdAt.toISOString(),
    }))
  })
}
