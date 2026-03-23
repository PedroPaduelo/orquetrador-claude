import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../../../middlewares/rbac.js'
import { aggregateDailyMetrics, aggregateBackfill } from './metrics-aggregator.js'

export async function metricsAggregatorRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.post('/admin/metrics/aggregate', {
    schema: {
      tags: ['Admin'],
      summary: 'Trigger manual da agregacao de metricas diarias',
      body: z.object({
        date: z.string().date().optional(),
      }).nullish().default({}),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const body = request.body as { date?: string } | undefined
    const date = body?.date ? new Date(body.date) : undefined
    await aggregateDailyMetrics(date)
    const label = date
      ? date.toISOString().split('T')[0]
      : 'ontem'
    return { message: `Agregacao concluida para ${label}` }
  })

  server.post('/admin/metrics/backfill', {
    schema: {
      tags: ['Admin'],
      summary: 'Preenche metricas dos ultimos N dias',
      body: z.object({
        days: z.number().int().min(1).max(365),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const { days } = request.body
    await aggregateBackfill(days)
    return { message: `Backfill concluido para os ultimos ${days} dias` }
  })
}
