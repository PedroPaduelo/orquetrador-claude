import { prisma } from '../../../lib/prisma.js'

const RETENTION_DAYS = 7
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h

async function cleanupOldTraces() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  try {
    const result = await prisma.executionTrace.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    if (result.count > 0) {
      console.log(`[TraceCleanup] Deleted ${result.count} traces older than ${RETENTION_DAYS} days`)
    }
  } catch (err) {
    console.error('[TraceCleanup] Error during cleanup:', err)
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null

export function startTraceCleanup() {
  cleanupOldTraces()
  intervalHandle = setInterval(cleanupOldTraces, CLEANUP_INTERVAL_MS)
}

export function stopTraceCleanup() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
