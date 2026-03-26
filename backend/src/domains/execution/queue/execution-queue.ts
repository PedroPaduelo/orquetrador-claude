import { Queue, type Job, type JobsOptions } from 'bullmq'
import { getRedis } from '../../../lib/redis.js'

export interface ExecutionJobData {
  conversationId: string
  workflowId: string
  userId: string
  content: string
  stepIndex?: number
  projectPath: string
  workflowType: string
  attachments?: Array<{
    id: string
    filename: string
    mimeType: string
    path: string
    projectPath: string
    url: string
    size?: number
  }>
  // Resume fields
  isResume?: boolean
  pausedExecutionId?: string
  pausedStepIndex?: number
  pausedStepId?: string
  pausedResumeToken?: string | null
  pausedAskUserQuestion?: { question: string; options?: Array<{ label: string; description?: string }> }
  maxConcurrency?: number
}

let _queue: Queue<ExecutionJobData> | null = null

export function getExecutionQueue(): Queue<ExecutionJobData> | null {
  if (!_queue) {
    try {
      _queue = new Queue<ExecutionJobData>('execution', {
        connection: getRedis() as any,
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
          attempts: 1, // Execution should not auto-retry
        },
      })
    } catch {
      console.warn('[ExecutionQueue] Failed to create queue (Redis unavailable)')
      return null
    }
  }
  return _queue
}

export interface EnqueueOptions {
  priority?: number
  jobId?: string
}

/**
 * Enqueue an execution job into the BullMQ queue.
 * Throws if the queue is unavailable (e.g. Redis is down).
 */
export async function enqueueExecution(
  data: ExecutionJobData,
  options?: EnqueueOptions,
): Promise<Job<ExecutionJobData>> {
  const queue = getExecutionQueue()
  if (!queue) {
    throw new Error('[ExecutionQueue] Queue unavailable — Redis may be down. Cannot enqueue execution.')
  }

  const jobOptions: JobsOptions = {}
  if (options?.priority !== undefined) {
    jobOptions.priority = options.priority
  }
  if (options?.jobId) {
    jobOptions.jobId = options.jobId
  } else {
    jobOptions.jobId = `exec-${data.conversationId}-${Date.now()}`
  }

  const job = await queue.add('execution', data, jobOptions)
  console.log(
    `[ExecutionQueue] Enqueued job ${job.id} for conversation ${data.conversationId}` +
    (data.isResume ? ` (resume of ${data.pausedExecutionId})` : ''),
  )
  return job
}

export async function closeExecutionQueue(): Promise<void> {
  if (_queue) {
    try {
      await _queue.close()
    } catch { /* ignore */ }
    _queue = null
  }
}
