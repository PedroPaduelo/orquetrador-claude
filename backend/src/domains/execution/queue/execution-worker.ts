import { Worker } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'
import { processExecutionJob } from './execution-processor.js'
import type { ExecutionJobData } from './execution-queue.js'

const CONCURRENCY = parseInt(process.env.EXECUTION_CONCURRENCY || '3', 10)

// How often BullMQ checks for stalled jobs (ms). Default in BullMQ is 30s.
const STALLED_INTERVAL = parseInt(process.env.EXECUTION_STALLED_INTERVAL || '30000', 10)

// Max times a job can be stalled before being marked as failed
const MAX_STALLED_COUNT = parseInt(process.env.EXECUTION_MAX_STALLED_COUNT || '1', 10)

let _worker: Worker<ExecutionJobData> | null = null

export function startExecutionWorker(): void {
  if (_worker) return

  try {
    _worker = new Worker<ExecutionJobData>(
      'execution',
      processExecutionJob,
      {
        connection: getRedis() as any,
        concurrency: CONCURRENCY,
        stalledInterval: STALLED_INTERVAL,
        maxStalledCount: MAX_STALLED_COUNT,
      }
    )

    _worker.on('completed', (job) => {
      console.log(`[ExecutionWorker] Job ${job.id} completed for conversation ${job.data.conversationId}`)
    })

    _worker.on('failed', (job, err) => {
      console.error(`[ExecutionWorker] Job ${job?.id} failed:`, err.message)
    })

    _worker.on('stalled', (jobId) => {
      console.warn(`[ExecutionWorker] Job ${jobId} stalled — it may have exceeded the lock duration or the process crashed`)
    })

    _worker.on('error', (err) => {
      console.error(`[ExecutionWorker] Error:`, err.message)
    })

    console.log(
      `[ExecutionWorker] Started with concurrency=${CONCURRENCY}, ` +
      `stalledInterval=${STALLED_INTERVAL}ms, maxStalledCount=${MAX_STALLED_COUNT}`,
    )
  } catch (err) {
    console.warn(`[ExecutionWorker] Failed to start (Redis unavailable), queue disabled:`, (err as Error).message)
    _worker = null
  }
}

export async function stopExecutionWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
    console.log('[ExecutionWorker] Stopped')
  }
}
