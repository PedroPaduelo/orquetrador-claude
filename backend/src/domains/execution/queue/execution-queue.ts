import { Queue } from 'bullmq'
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
}

let _queue: Queue<ExecutionJobData> | null = null

export function getExecutionQueue(): Queue<ExecutionJobData> {
  if (!_queue) {
    _queue = new Queue<ExecutionJobData>('execution', {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1, // Execution should not auto-retry
      },
    })
  }
  return _queue
}

export async function closeExecutionQueue(): Promise<void> {
  if (_queue) {
    await _queue.close()
    _queue = null
  }
}
