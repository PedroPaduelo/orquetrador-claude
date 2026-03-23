import { prisma } from '../../../lib/prisma.js'

export async function recoverStaleExecutions(): Promise<number> {
  try {
    // Find all stale running executions
    const staleExecutions = await prisma.executionState.findMany({
      where: { state: 'running' },
      select: { id: true, metadata: true },
    })

    if (staleExecutions.length === 0) return 0

    // Update each one, merging metadata
    let count = 0
    for (const exec of staleExecutions) {
      const existingMeta = typeof exec.metadata === 'object' && exec.metadata !== null
        ? exec.metadata as Record<string, unknown>
        : {}

      await prisma.executionState.update({
        where: { id: exec.id },
        data: {
          state: 'failed',
          metadata: {
            ...existingMeta,
            recoveryError: 'Server restarted during execution',
            recoveryFailedAt: new Date().toISOString(),
          },
        },
      })
      count++
    }

    if (count > 0) {
      console.log(`[Recovery] Marked ${count} stale executions as failed (metadata preserved)`)
    }
    return count
  } catch (err) {
    console.error('[Recovery] Failed to recover stale executions:', (err as Error).message)
    return 0
  }
}
