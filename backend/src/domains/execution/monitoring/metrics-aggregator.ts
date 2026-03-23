import { prisma } from '../../../lib/prisma.js'
import { aggregateResourcePerformance } from './resource-performance.service.js'

const AGGREGATION_INTERVAL_MS = 60 * 60 * 1000 // 1 hora

function dayBounds(date: Date) {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function yesterday() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export async function aggregateDailyMetrics(date?: Date) {
  const targetDate = date ?? yesterday()
  const { start, end } = dayBounds(targetDate)

  const traces = await prisma.executionTrace.findMany({
    where: {
      startedAt: { gte: start, lt: end },
    },
    select: {
      resultStatus: true,
      inputTokens: true,
      outputTokens: true,
      totalCostUsd: true,
      durationMs: true,
      errorCategory: true,
      model: true,
      conversationId: true,
      conversation: {
        select: { workflowId: true, userId: true },
      },
    },
  })

  if (traces.length === 0) {
    console.log(`[MetricsAggregator] Nenhum trace para ${start.toISOString().split('T')[0]}`)
    return
  }

  let successCount = 0
  let failureCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0
  const durations: number[] = []
  const workflowIds = new Set<string>()
  const userIds = new Set<string>()
  const errorMap: Record<string, number> = {}
  const modelMap: Record<string, { count: number; tokens: number; cost: number }> = {}

  for (const t of traces) {
    if (t.resultStatus === 'success') successCount++
    else failureCount++

    totalInputTokens += t.inputTokens
    totalOutputTokens += t.outputTokens
    totalCostUsd += t.totalCostUsd ?? 0

    if (t.durationMs != null) durations.push(t.durationMs)

    workflowIds.add(t.conversation.workflowId)
    userIds.add(t.conversation.userId)

    if (t.errorCategory) {
      errorMap[t.errorCategory] = (errorMap[t.errorCategory] || 0) + 1
    }

    const model = t.model ?? 'unknown'
    if (!modelMap[model]) modelMap[model] = { count: 0, tokens: 0, cost: 0 }
    modelMap[model].count++
    modelMap[model].tokens += t.inputTokens + t.outputTokens
    modelMap[model].cost += t.totalCostUsd ?? 0
  }

  durations.sort((a, b) => a - b)
  const avgDurationMs = durations.length > 0
    ? durations.reduce((s, v) => s + v, 0) / durations.length
    : null
  const p50DurationMs = durations.length > 0 ? percentile(durations, 50) : null
  const p95DurationMs = durations.length > 0 ? percentile(durations, 95) : null

  const dateOnly = new Date(start)

  await prisma.dailyExecutionMetrics.upsert({
    where: { date: dateOnly },
    create: {
      date: dateOnly,
      totalExecutions: traces.length,
      successCount,
      failureCount,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      uniqueWorkflows: workflowIds.size,
      uniqueUsers: userIds.size,
      errorBreakdown: errorMap,
      modelBreakdown: modelMap,
    },
    update: {
      totalExecutions: traces.length,
      successCount,
      failureCount,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      uniqueWorkflows: workflowIds.size,
      uniqueUsers: userIds.size,
      errorBreakdown: errorMap,
      modelBreakdown: modelMap,
    },
  })

  console.log(
    `[MetricsAggregator] ${start.toISOString().split('T')[0]}: ` +
    `${traces.length} execucoes, ${successCount} sucesso, ${failureCount} falha`
  )
}

export async function aggregateBackfill(days: number) {
  console.log(`[MetricsAggregator] Backfill dos ultimos ${days} dias...`)
  for (let i = 1; i <= days; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    await runAllAggregations(d)
  }
  console.log(`[MetricsAggregator] Backfill concluido (${days} dias)`)
}

let intervalHandle: ReturnType<typeof setInterval> | null = null

async function runAllAggregations(date?: Date) {
  await aggregateDailyMetrics(date)
  await aggregateResourcePerformance(date)
}

export function startMetricsAggregation() {
  // Roda imediatamente para ontem
  runAllAggregations().catch(err => {
    console.error('[MetricsAggregator] Erro na agregacao inicial:', err)
  })
  intervalHandle = setInterval(() => {
    runAllAggregations().catch(err => {
      console.error('[MetricsAggregator] Erro na agregacao periodica:', err)
    })
  }, AGGREGATION_INTERVAL_MS)
}

export function stopMetricsAggregation() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
