import { apiClient } from '@/shared/lib/api-client'

export interface WorkflowSummary {
  id: string
  name: string
  description: string | null
  type: string
  stepsCount: number
  steps: Array<{ id: string; name: string; stepOrder: number }>
}

export interface StepResult {
  stepName: string
  stepOrder: number
  content: string
}

export interface ExecutionResult {
  conversationId: string
  status: 'completed' | 'paused' | 'error' | 'running' | 'idle'
  result: {
    content: string
    steps: StepResult[]
    messagesCount: number
  }
  pausedInfo: {
    stepName?: string
    question?: string
    options?: Array<{ label: string; description?: string }>
  } | null
}

export const workflowChatApi = {
  listWorkflows: () =>
    apiClient.get<WorkflowSummary[]>('/api/v1/workflows').then((r) => r.data),

  getStatus: (conversationId: string) =>
    apiClient.get<ExecutionResult>(`/api/v1/executions/${conversationId}`).then((r) => r.data),

  cancel: (conversationId: string) =>
    apiClient.post(`/api/v1/executions/${conversationId}/cancel`).then((r) => r.data),
}
