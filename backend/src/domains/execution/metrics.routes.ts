import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

export async function metricsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/metrics/daily', {
    schema: { tags: ['Metrics'], summary: 'Daily execution metrics (30 days)' },
  }, async (request) => {
    await request.getCurrentUserId()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Use pre-aggregated DailyExecutionMetrics instead of scanning all traces
    const metrics = await prisma.dailyExecutionMetrics.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    })

    return metrics.map((m) => ({
      date: m.date.toISOString().split('T')[0],
      cost: Math.round(m.totalCostUsd * 100) / 100,
      tokens: m.totalInputTokens + m.totalOutputTokens,
      executions: m.totalExecutions,
      errors: m.failureCount,
      p50DurationMs: m.p50DurationMs,
      p95DurationMs: m.p95DurationMs,
      errorBreakdown: m.errorBreakdown,
      modelBreakdown: m.modelBreakdown,
    }))
  })

  server.get('/metrics/by-workflow', {
    schema: { tags: ['Metrics'], summary: 'Metrics aggregated by workflow' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()

    // Use groupBy with aggregation instead of loading all traces
    const results = await prisma.executionTrace.groupBy({
      by: ['conversationId'],
      where: { conversation: { userId } },
      _sum: {
        totalCostUsd: true,
        durationMs: true,
      },
      _count: { id: true },
    })

    // Get workflow info for each conversation (deduplicated)
    const conversationIds = results.map(r => r.conversationId)
    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      select: { id: true, workflowId: true, workflow: { select: { name: true } } },
    })
    const convMap = new Map(conversations.map(c => [c.id, c]))

    // Count successes per conversation
    const successCounts = await prisma.executionTrace.groupBy({
      by: ['conversationId'],
      where: {
        conversation: { userId },
        resultStatus: 'success',
      },
      _count: { id: true },
    })
    const successMap = new Map(successCounts.map(s => [s.conversationId, s._count.id]))

    // Aggregate by workflow
    const wfMap = new Map<string, { name: string; cost: number; executions: number; successes: number; totalDuration: number }>()

    for (const r of results) {
      const conv = convMap.get(r.conversationId)
      if (!conv) continue
      const wfId = conv.workflowId
      const entry = wfMap.get(wfId) || { name: conv.workflow.name, cost: 0, executions: 0, successes: 0, totalDuration: 0 }
      entry.cost += r._sum.totalCostUsd || 0
      entry.executions += r._count.id
      entry.successes += successMap.get(r.conversationId) || 0
      entry.totalDuration += r._sum.durationMs || 0
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

    // Use count + aggregate instead of loading all traces
    const [totals, errorCount] = await Promise.all([
      prisma.executionTrace.aggregate({
        where: {
          conversation: { userId },
          createdAt: { gte: since },
        },
        _count: { id: true },
        _sum: { totalCostUsd: true },
      }),
      prisma.executionTrace.count({
        where: {
          conversation: { userId },
          createdAt: { gte: since },
          resultStatus: 'error',
        },
      }),
    ])

    const alerts: Array<{ type: string; severity: 'warning' | 'danger'; message: string }> = []
    const total = totals._count.id
    if (total === 0) return alerts

    const errorRate = errorCount / total
    if (errorRate > 0.3) {
      alerts.push({ type: 'error_rate', severity: 'danger', message: `Error rate is ${Math.round(errorRate * 100)}% in last 24h (${errorCount}/${total})` })
    }

    const totalCost = totals._sum.totalCostUsd || 0
    if (totalCost > 10) {
      alerts.push({ type: 'cost', severity: 'warning', message: `Daily cost is $${totalCost.toFixed(2)}` })
    }

    return alerts
  })

  server.get('/metrics/tool-analytics', {
    schema: {
      tags: ['Metrics'],
      summary: 'Top tools by usage, success rate, and average duration',
      querystring: z.object({
        days: z.coerce.number().min(1).max(90).default(7),
        limit: z.coerce.number().min(1).max(50).default(20),
      }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const { days, limit } = request.query
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const toolStats = await prisma.executionToolCall.groupBy({
      by: ['toolName'],
      where: {
        trace: {
          conversation: { userId },
          createdAt: { gte: since },
        },
      },
      _count: { id: true },
      _avg: { durationMs: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })

    // Get success counts separately
    const successCounts = await prisma.executionToolCall.groupBy({
      by: ['toolName'],
      where: {
        trace: {
          conversation: { userId },
          createdAt: { gte: since },
        },
        success: true,
      },
      _count: { id: true },
    })
    const successMap = new Map(successCounts.map(s => [s.toolName, s._count.id]))

    return toolStats.map(t => ({
      toolName: t.toolName,
      count: t._count.id,
      successRate: t._count.id > 0 ? Math.round(((successMap.get(t.toolName) || 0) / t._count.id) * 100) : 0,
      avgDurationMs: Math.round(t._avg.durationMs || 0),
    }))
  })

  // GET /executions - list all executions with status
  server.get('/executions', {
    schema: {
      tags: ['Metrics'],
      summary: 'List all executions with status and conversation info',
      querystring: z.object({
        state: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
      }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const { state, limit } = request.query

    const where: Record<string, unknown> = {
      conversation: { userId },
    }
    if (state) where.state = state

    const executions = await prisma.executionState.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            projectPath: true,
            workflow: { select: { id: true, name: true, type: true } },
          },
        },
      },
    })

    return executions.map(e => {
      const metadata = (e.metadata || {}) as Record<string, unknown>
      return {
        id: e.id,
        state: e.state,
        currentStepIndex: e.currentStepIndex,
        conversationId: e.conversationId,
        conversationTitle: e.conversation.title,
        projectPath: e.conversation.projectPath,
        workflowName: e.conversation.workflow.name,
        workflowType: e.conversation.workflow.type,
        startedAt: metadata.startedAt || e.createdAt.toISOString(),
        completedAt: metadata.completedAt || null,
        failedAt: metadata.failedAt || null,
        cancelledAt: metadata.cancelledAt || null,
        pausedAt: metadata.pausedAt || null,
        error: metadata.error || null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }
    })
  })

  // GET /executions/summary - quick summary of execution states
  server.get('/executions/summary', {
    schema: {
      tags: ['Metrics'],
      summary: 'Get summary counts of executions by state',
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()

    const counts = await prisma.executionState.groupBy({
      by: ['state'],
      where: { conversation: { userId } },
      _count: { id: true },
    })

    const summary: Record<string, number> = {
      running: 0,
      paused: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    for (const c of counts) {
      summary[c.state] = c._count.id
    }

    return summary
  })
}
