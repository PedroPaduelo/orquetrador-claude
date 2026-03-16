import { prisma } from '../../../lib/prisma.js'

export async function recoverStaleExecutions(): Promise<number> {
  try {
    const result = await prisma.executionState.updateMany({
      where: { state: 'running' },
      data: {
        state: 'failed',
        metadata: JSON.stringify({
          error: 'Server restarted during execution',
          failedAt: new Date().toISOString(),
        }),
      },
    })
    if (result.count > 0) {
      console.log(`[Recovery] Marked ${result.count} stale executions as failed`)
    }
    return result.count
  } catch (err) {
    console.error('[Recovery] Failed to recover stale executions:', (err as Error).message)
    return 0
  }
}
