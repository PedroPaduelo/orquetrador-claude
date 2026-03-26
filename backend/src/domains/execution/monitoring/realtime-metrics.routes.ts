import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  getWorkflowMetrics,
  getInFlightSummary,
  getQuickStats,
} from './realtime-metrics-aggregator.js'

export async function realtimeMetricsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  /**
   * GET /metrics/executions
   *
   * Returns aggregated real-time metrics from the 1-hour rolling window.
   * Groups by workflow. Includes latency percentiles, success/error rates,
   * cost analysis, and bottleneck detection.
   */
  server.get('/metrics/executions', {
    schema: {
      tags: ['Metrics'],
      summary: 'Real-time aggregated execution metrics (1h rolling window)',
      querystring: z.object({
        workflowId: z.string().uuid().optional(),
      }),
      response: {
        200: z.object({
          quick: z.object({
            totalInWindow: z.number(),
            successes: z.number(),
            failures: z.number(),
            successRate: z.number(),
            inFlight: z.number(),
            windowMs: z.number(),
          }),
          workflows: z.array(z.object({
            workflowId: z.string().nullable(),
            workflowName: z.string().nullable(),
            totalExecutions: z.number(),
            latency: z.object({
              p50: z.number(),
              p95: z.number(),
              p99: z.number(),
              mean: z.number(),
              min: z.number(),
              max: z.number(),
            }),
            successRate: z.number(),
            errorRate: z.number(),
            errorsByType: z.record(z.string(), z.number()),
            avgCostPerExecution: z.number(),
            totalCost: z.number(),
            avgStepsCompleted: z.number(),
            bottleneck: z.object({
              stepName: z.string(),
              avgDurationMs: z.number(),
            }).nullable(),
            windowStart: z.string(),
            windowEnd: z.string(),
          })),
          inFlight: z.array(z.object({
            executionId: z.string(),
            conversationId: z.string(),
            runningForMs: z.number(),
            completedSteps: z.number(),
            activeSteps: z.array(z.string()),
          })),
        }),
      },
    },
  }, async (request) => {
    // Require authenticated user
    await request.getCurrentUserId()

    const { workflowId } = request.query
    const workflows = await getWorkflowMetrics(workflowId)
    const quick = getQuickStats()
    const inFlight = getInFlightSummary()

    return {
      quick,
      workflows,
      inFlight,
    }
  })
}
