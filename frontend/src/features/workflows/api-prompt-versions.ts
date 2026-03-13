import { apiClient } from '@/shared/lib/api-client'

export interface PromptVersion {
  id: string
  stepId: string
  version: number
  content: string
  diff: string | null
  createdAt: string
  createdBy: string | null
}

export const promptVersionsApi = {
  list: async (workflowId: string, stepId: string) => {
    const { data } = await apiClient.get<PromptVersion[]>(
      `/workflows/${workflowId}/steps/${stepId}/prompt-versions`
    )
    return data
  },
  rollback: async (workflowId: string, stepId: string, versionId: string) => {
    const { data } = await apiClient.post(
      `/workflows/${workflowId}/steps/${stepId}/prompt-versions/${versionId}/rollback`
    )
    return data
  },
}
