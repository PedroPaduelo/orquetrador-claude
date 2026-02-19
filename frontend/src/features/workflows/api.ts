import { apiClient } from '@/shared/lib/api-client'
import type { Workflow, WorkflowInput } from './types'

export const workflowsApi = {
  list: async (): Promise<Workflow[]> => {
    const { data } = await apiClient.get('/workflows')
    return data
  },

  get: async (id: string): Promise<Workflow> => {
    const { data } = await apiClient.get(`/workflows/${id}`)
    return data
  },

  create: async (input: WorkflowInput): Promise<Workflow> => {
    const { data } = await apiClient.post('/workflows', input)
    return data
  },

  update: async (id: string, input: Partial<WorkflowInput>): Promise<Workflow> => {
    const { data } = await apiClient.put(`/workflows/${id}`, input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/workflows/${id}`)
  },

  duplicate: async (id: string): Promise<Workflow> => {
    const { data } = await apiClient.post(`/workflows/${id}/duplicate`)
    return data
  },
}
