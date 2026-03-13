import { Worker } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'
import { processExecutionJob } from './execution-processor.js'
import type { ExecutionJobData } from './execution-queue.js'

const CONCURRENCY = parseInt(process.env.EXECUTION_CONCURRENCY || '3', 10)

let _worker: Worker<ExecutionJobData> | null = null

export function startExecutionWorker(): Worker<ExecutionJobData> {
  if (_worker) return _worker

  _worker = new Worker<ExecutionJobData>(
    'execution',
    processExecutionJob,
    {
      connection: getRedis(),
      concurrency: CONCURRENCY,
    }
  )

  _worker.on('completed', (job) => {
    console.log(`[ExecutionWorker] Job ${job.id} completed for conversation ${job.data.conversationId}`)
  })

  _worker.on('failed', (job, err) => {
    console.error(`[ExecutionWorker] Job ${job?.id} failed:`, err.message)
  })

  console.log(`[ExecutionWorker] Started with concurrency=${CONCURRENCY}`)
  return _worker
}

export async function stopExecutionWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
    console.log('[ExecutionWorker] Stopped')
  }
}
