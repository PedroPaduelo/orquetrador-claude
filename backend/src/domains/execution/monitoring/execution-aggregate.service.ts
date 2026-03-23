import { prisma } from '../../../lib/prisma.js'

export async function createOrUpdateAggregate(
  executionId: string,
  conversationId: string,
): Promise<void> {
  const traces = await prisma.executionTrace.findMany({
    where: { executionId },
    select: {
      resultStatus: true,
      inputTokens: true,
      outputTokens: true,
      totalCostUsd: true,
      durationMs: true,
      startedAt: true,
      completedAt: true,
    },
  })

  if (traces.length === 0) return

  let completedSteps = 0
  let failedSteps = 0
  let skippedSteps = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0
  let totalDurationMs = 0
  let earliestStart: Date | null = null
  let latestEnd: Date | null = null

  for (const trace of traces) {
    totalInputTokens += trace.inputTokens
    totalOutputTokens += trace.outputTokens
    totalCostUsd += trace.totalCostUsd ?? 0
    totalDurationMs += trace.durationMs ?? 0

    if (!earliestStart || trace.startedAt < earliestStart) {
      earliestStart = trace.startedAt
    }
    if (trace.completedAt && (!latestEnd || trace.completedAt > latestEnd)) {
      latestEnd = trace.completedAt
    }

    switch (trace.resultStatus) {
      case 'success':
        completedSteps++
        break
      case 'error':
      case 'timeout':
        failedSteps++
        break
      case 'cancelled':
      case 'interrupted':
        skippedSteps++
        break
      default:
        completedSteps++
    }
  }

  // Get workflowId from Conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { workflowId: true },
  })

  const workflowId = conversation?.workflowId ?? ''

  // Determine finalStatus from execution state
  const execution = await prisma.executionState.findFirst({
    where: { id: executionId },
    select: { state: true },
  })

  const stateStr = execution?.state ?? (failedSteps > 0 ? 'failed' : 'completed')
  // Map ExecutionStateStatus to ExecutionAggregateStatus (running, completed, failed)
  const finalStatus = stateStr === 'running' ? 'running' as const
    : stateStr === 'failed' || stateStr === 'cancelled' ? 'failed' as const
    : 'completed' as const

  await prisma.executionAggregate.upsert({
    where: { executionId },
    create: {
      executionId,
      conversationId,
      workflowId,
      totalSteps: traces.length,
      completedSteps,
      failedSteps,
      skippedSteps,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
      totalDurationMs: totalDurationMs > 0 ? totalDurationMs : null,
      startedAt: earliestStart!,
      completedAt: latestEnd,
      finalStatus,
    },
    update: {
      totalSteps: traces.length,
      completedSteps,
      failedSteps,
      skippedSteps,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
      totalDurationMs: totalDurationMs > 0 ? totalDurationMs : null,
      completedAt: latestEnd,
      finalStatus,
    },
  })
}
