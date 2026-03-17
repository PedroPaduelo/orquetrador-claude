import { Worker } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'
import { processExecutionJob } from './execution-processor.js'
import type { ExecutionJobData } from './execution-queue.js'

const CONCURRENCY = parseInt(process.env.EXECUTION_CONCURRENCY || '3', 10)

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
      }
    )

    _worker.on('completed', (job) => {
      console.log(`[ExecutionWorker] Job ${job.id} completed for conversation ${job.data.conversationId}`)
    })

    _worker.on('failed', (job, err) => {
      console.error(`[ExecutionWorker] Job ${job?.id} failed:`, err.message)
    })

    _worker.on('error', (err) => {
      console.error(`[ExecutionWorker] Error:`, err.message)
    })

    console.log(`[ExecutionWorker] Started with concurrency=${CONCURRENCY}`)
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
