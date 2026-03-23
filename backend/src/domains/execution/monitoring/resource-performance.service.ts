import { ResourceType } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

function dayBounds(date: Date) {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

interface ResourceRef {
  type: ResourceType
  id: string
}

export async function aggregateResourcePerformance(date?: Date) {
  const targetDate = date ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d })()
  const { start, end } = dayBounds(targetDate)

  // Fetch traces with step info to map resources
  const traces = await prisma.executionTrace.findMany({
    where: { startedAt: { gte: start, lt: end } },
    select: {
      stepId: true,
      resultStatus: true,
      durationMs: true,
      totalCostUsd: true,
    },
  })

  if (traces.length === 0) return

  // Collect unique stepIds
  const stepIds = [...new Set(traces.map(t => t.stepId))]

  // Fetch resource mappings for these steps
  const [mcpServers, skills, agents] = await Promise.all([
    prisma.workflowStepMcpServer.findMany({
      where: { stepId: { in: stepIds } },
      select: { stepId: true, serverId: true },
    }),
    prisma.workflowStepSkill.findMany({
      where: { stepId: { in: stepIds } },
      select: { stepId: true, skillId: true },
    }),
    prisma.workflowStepAgent.findMany({
      where: { stepId: { in: stepIds } },
      select: { stepId: true, agentId: true },
    }),
  ])

  // Build stepId -> resources map
  const stepResources = new Map<string, ResourceRef[]>()
  for (const m of mcpServers) {
    const list = stepResources.get(m.stepId) || []
    list.push({ type: 'mcp_server', id: m.serverId })
    stepResources.set(m.stepId, list)
  }
  for (const s of skills) {
    const list = stepResources.get(s.stepId) || []
    list.push({ type: 'skill', id: s.skillId })
    stepResources.set(s.stepId, list)
  }
  for (const a of agents) {
    const list = stepResources.get(a.stepId) || []
    list.push({ type: 'agent', id: a.agentId })
    stepResources.set(a.stepId, list)
  }

  // Aggregate per resource
  const resourceStats = new Map<string, {
    type: ResourceType
    id: string
    executions: number
    successes: number
    durations: number[]
    cost: number
  }>()

  for (const trace of traces) {
    const resources = stepResources.get(trace.stepId) || []
    for (const res of resources) {
      const key = `${res.type}:${res.id}`
      const stats = resourceStats.get(key) || {
        type: res.type,
        id: res.id,
        executions: 0,
        successes: 0,
        durations: [],
        cost: 0,
      }
      stats.executions++
      if (trace.resultStatus === 'success') stats.successes++
      if (trace.durationMs != null) stats.durations.push(trace.durationMs)
      stats.cost += trace.totalCostUsd ?? 0
      resourceStats.set(key, stats)
    }
  }

  // Upsert metrics
  const dateOnly = new Date(start)
  for (const stats of resourceStats.values()) {
    stats.durations.sort((a, b) => a - b)
    const avgDurationMs = stats.durations.length > 0
      ? stats.durations.reduce((s, v) => s + v, 0) / stats.durations.length
      : null
    const p95DurationMs = stats.durations.length > 0
      ? percentile(stats.durations, 95)
      : null

    await prisma.resourcePerformanceMetric.upsert({
      where: {
        resourceType_resourceId_period_periodStart: {
          resourceType: stats.type,
          resourceId: stats.id,
          period: 'daily',
          periodStart: dateOnly,
        },
      },
      create: {
        resourceType: stats.type,
        resourceId: stats.id,
        period: 'daily',
        periodStart: dateOnly,
        executionCount: stats.executions,
        successCount: stats.successes,
        avgDurationMs,
        p95DurationMs,
        totalCostUsd: Math.round(stats.cost * 1_000_000) / 1_000_000,
      },
      update: {
        executionCount: stats.executions,
        successCount: stats.successes,
        avgDurationMs,
        p95DurationMs,
        totalCostUsd: Math.round(stats.cost * 1_000_000) / 1_000_000,
      },
    })
  }

  console.log(
    `[ResourcePerformance] ${start.toISOString().split('T')[0]}: ` +
    `${resourceStats.size} recursos agregados`
  )
}
