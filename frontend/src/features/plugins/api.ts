import { apiClient } from '@/shared/lib/api-client'
import type { Plugin, PluginInput } from './types'

export const pluginsApi = {
  list: async (): Promise<Plugin[]> => {
    const { data } = await apiClient.get('/plugins')
    return data
  },

  install: async (input: PluginInput): Promise<Plugin> => {
    const { data } = await apiClient.post('/plugins', input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/plugins/${id}`)
  },

  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/plugins/${id}/toggle`)
    return data
  },
}
