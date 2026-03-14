import { apiClient } from '@/shared/lib/api-client'

export interface Execution {
  id: string
  state: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  currentStepIndex: number
  conversationId: string
  conversationTitle: string | null
  projectPath: string | null
  workflowName: string
  workflowType: string
  startedAt: string
  completedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  pausedAt: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface ExecutionSummary {
  running: number
  paused: number
  queued: number
  completed: number
  failed: number
  cancelled: number
}

export const executionsApi = {
  list: async (state?: string, limit = 50): Promise<Execution[]> => {
    const params: Record<string, string | number> = { limit }
    if (state) params.state = state
    const { data } = await apiClient.get('/executions', { params })
    return data
  },

  summary: async (): Promise<ExecutionSummary> => {
    const { data } = await apiClient.get('/executions/summary')
    return data
  },
}
