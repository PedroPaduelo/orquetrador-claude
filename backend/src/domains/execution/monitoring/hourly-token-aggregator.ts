import { prisma } from '../../../lib/prisma.js'

export async function aggregateHourlyTokens(beforeDate: Date) {
  // Find traces that will be deleted, grouped by hour/userId/model
  const traces = await prisma.executionTrace.findMany({
    where: { createdAt: { lt: beforeDate } },
    select: {
      startedAt: true,
      inputTokens: true,
      outputTokens: true,
      totalCostUsd: true,
      model: true,
      conversation: { select: { userId: true } },
    },
  })

  if (traces.length === 0) return 0

  // Group by hour + userId + model
  const buckets = new Map<string, { hour: Date; userId: string; model: string | null; tokens: number; costUsd: number }>()

  for (const t of traces) {
    const hour = new Date(t.startedAt)
    hour.setUTCMinutes(0, 0, 0)

    const key = `${hour.toISOString()}:${t.conversation.userId}:${t.model ?? 'unknown'}`
    const bucket = buckets.get(key) || {
      hour,
      userId: t.conversation.userId,
      model: t.model,
      tokens: 0,
      costUsd: 0,
    }
    bucket.tokens += t.inputTokens + t.outputTokens
    bucket.costUsd += t.totalCostUsd ?? 0
    buckets.set(key, bucket)
  }

  // Upsert each bucket
  let count = 0
  for (const b of buckets.values()) {
    await prisma.hourlyTokenUsage.upsert({
      where: {
        hour_userId_model: {
          hour: b.hour,
          userId: b.userId,
          model: b.model ?? 'unknown',
        },
      },
      create: {
        hour: b.hour,
        userId: b.userId,
        model: b.model ?? 'unknown',
        tokens: b.tokens,
        costUsd: Math.round(b.costUsd * 1_000_000) / 1_000_000,
      },
      update: {
        tokens: { increment: b.tokens },
        costUsd: { increment: Math.round(b.costUsd * 1_000_000) / 1_000_000 },
      },
    })
    count++
  }

  console.log(`[HourlyTokenAggregator] Agregou ${traces.length} traces em ${count} buckets horarios`)
  return count
}
