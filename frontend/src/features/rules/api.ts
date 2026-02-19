import { apiClient } from '@/shared/lib/api-client'
import type { Rule, RuleInput } from './types'

export const rulesApi = {
  list: async (): Promise<Rule[]> => {
    const { data } = await apiClient.get('/rules')
    return data
  },
  get: async (id: string): Promise<Rule> => {
    const { data } = await apiClient.get(`/rules/${id}`)
    return data
  },
  create: async (input: RuleInput): Promise<Rule> => {
    const { data } = await apiClient.post('/rules', input)
    return data
  },
  update: async (id: string, input: Partial<RuleInput>): Promise<Rule> => {
    const { data } = await apiClient.put(`/rules/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/rules/${id}`)
  },
  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/rules/${id}/toggle`)
    return data
  },
  import: async (input: { url?: string; content?: string; isGlobal?: boolean }): Promise<Rule> => {
    const { data } = await apiClient.post('/rules/import', input)
    return data
  },
  resync: async (id: string): Promise<{ id: string; name: string; lastSyncedAt: string }> => {
    const { data } = await apiClient.post(`/rules/${id}/resync`)
    return data
  },
}
