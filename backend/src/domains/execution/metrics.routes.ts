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
      const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : (e.metadata || {})
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
