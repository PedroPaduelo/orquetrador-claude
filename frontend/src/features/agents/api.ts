import { apiClient } from '@/shared/lib/api-client'
import type { Agent, AgentInput } from './types'

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const { data } = await apiClient.get('/agents')
    return data
  },

  get: async (id: string): Promise<Agent> => {
    const { data } = await apiClient.get(`/agents/${id}`)
    return data
  },

  create: async (input: AgentInput): Promise<Agent> => {
    const { data } = await apiClient.post('/agents', input)
    return data
  },

  update: async (id: string, input: Partial<AgentInput>): Promise<Agent> => {
    const { data } = await apiClient.put(`/agents/${id}`, input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/agents/${id}`)
  },

  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/agents/${id}/toggle`)
    return data
  },

  import: async (input: { url?: string; content?: string; isGlobal?: boolean }): Promise<Agent> => {
    const { data } = await apiClient.post('/agents/import', input)
    return data
  },
}
