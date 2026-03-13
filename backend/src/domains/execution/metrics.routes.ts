import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

export async function metricsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/metrics/daily', {
    schema: { tags: ['Metrics'], summary: 'Daily execution metrics (30 days)' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const traces = await prisma.executionTrace.findMany({
      where: {
        conversation: { userId },
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
        totalCostUsd: true,
        inputTokens: true,
        outputTokens: true,
        resultStatus: true,
      },
    })

    const dailyMap = new Map<string, { cost: number; tokens: number; executions: number; errors: number }>()

    for (const t of traces) {
      const day = t.createdAt.toISOString().split('T')[0]
      const entry = dailyMap.get(day) || { cost: 0, tokens: 0, executions: 0, errors: 0 }
      entry.cost += t.totalCostUsd || 0
      entry.tokens += t.inputTokens + t.outputTokens
      entry.executions++
      if (t.resultStatus === 'error') entry.errors++
      dailyMap.set(day, entry)
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  })

  server.get('/metrics/by-workflow', {
    schema: { tags: ['Metrics'], summary: 'Metrics aggregated by workflow' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()

    const traces = await prisma.executionTrace.findMany({
      where: { conversation: { userId } },
      select: {
        totalCostUsd: true,
        inputTokens: true,
        outputTokens: true,
        resultStatus: true,
        durationMs: true,
        conversation: {
          select: { workflowId: true, workflow: { select: { name: true } } },
        },
      },
    })

    const wfMap = new Map<string, { name: string; cost: number; executions: number; successes: number; avgDuration: number; totalDuration: number }>()

    for (const t of traces) {
      const wfId = t.conversation.workflowId
      const entry = wfMap.get(wfId) || { name: t.conversation.workflow.name, cost: 0, executions: 0, successes: 0, avgDuration: 0, totalDuration: 0 }
      entry.cost += t.totalCostUsd || 0
      entry.executions++
      if (t.resultStatus === 'success') entry.successes++
      entry.totalDuration += t.durationMs || 0
      wfMap.set(wfId, entry)
    }

    return Array.from(wfMap.entries()).map(([id, data]) => ({
      workflowId: id,
      name: data.name,
      cost: Math.round(data.cost * 100) / 100,
      executions: data.executions,
      successRate: data.executions > 0 ? Math.round((data.successes / data.executions) * 100) : 0,
      avgDurationMs: data.executions > 0 ? Math.round(data.totalDuration / data.executions) : 0,
    }))
  })

  server.get('/metrics/alerts', {
    schema: { tags: ['Metrics'], summary: 'Active alerts based on metrics thresholds' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const recentTraces = await prisma.executionTrace.findMany({
      where: {
        conversation: { userId },
        createdAt: { gte: since },
      },
      select: {
        resultStatus: true,
        totalCostUsd: true,
      },
    })

    const alerts: Array<{ type: string; severity: 'warning' | 'danger'; message: string }> = []
    const total = recentTraces.length
    if (total === 0) return alerts

    const errors = recentTraces.filter(t => t.resultStatus === 'error').length
    const errorRate = errors / total
    if (errorRate > 0.3) {
      alerts.push({ type: 'error_rate', severity: 'danger', message: `Error rate is ${Math.round(errorRate * 100)}% in last 24h (${errors}/${total})` })
    }

    const totalCost = recentTraces.reduce((sum, t) => sum + (t.totalCostUsd || 0), 0)
    if (totalCost > 10) {
      alerts.push({ type: 'cost', severity: 'warning', message: `Daily cost is $${totalCost.toFixed(2)}` })
    }

    return alerts
  })
}
