import { apiClient } from '@/shared/lib/api-client'
import type { Skill, SkillInput } from './types'

export const skillsApi = {
  list: async (): Promise<Skill[]> => {
    const { data } = await apiClient.get('/skills')
    return data
  },

  get: async (id: string): Promise<Skill> => {
    const { data } = await apiClient.get(`/skills/${id}`)
    return data
  },

  create: async (input: SkillInput): Promise<Skill> => {
    const { data } = await apiClient.post('/skills', input)
    return data
  },

  update: async (id: string, input: Partial<SkillInput>): Promise<Skill> => {
    const { data } = await apiClient.put(`/skills/${id}`, input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/skills/${id}`)
  },

  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/skills/${id}/toggle`)
    return data
  },

  import: async (input: { url?: string; content?: string; isGlobal?: boolean }): Promise<Skill> => {
    const { data } = await apiClient.post('/skills/import', input)
    return data
  },

  resync: async (id: string): Promise<{ id: string; name: string; filesUpdated: number; lastSyncedAt: string }> => {
    const { data } = await apiClient.post(`/skills/${id}/resync`)
    return data
  },
}
