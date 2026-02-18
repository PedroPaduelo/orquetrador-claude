import { apiClient } from '@/shared/lib/api-client'
import type { Plugin, PluginInput } from './types'

export const pluginsApi = {
  list: async (): Promise<Plugin[]> => {
    const { data } = await apiClient.get('/plugins')
    return data
  },

  get: async (id: string): Promise<Plugin> => {
    const { data } = await apiClient.get(`/plugins/${id}`)
    return data
  },

  install: async (input: PluginInput): Promise<Plugin> => {
    const { data } = await apiClient.post('/plugins', input)
    return data
  },

  update: async (id: string, input: Partial<{ name: string; description: string | null; version: string | null; author: string | null; enabled: boolean; projectPath: string | null }>): Promise<Plugin> => {
    const { data } = await apiClient.put(`/plugins/${id}`, input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/plugins/${id}`)
  },

  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/plugins/${id}/toggle`)
    return data
  },

  importUrl: async (input: { url: string; projectPath?: string }): Promise<Plugin> => {
    const { data } = await apiClient.post('/plugins/import-url', input)
    return data
  },

  resync: async (id: string, projectPath?: string): Promise<{ filesUpdated: number; skillsFound: number }> => {
    const { data } = await apiClient.post(`/plugins/${id}/resync`, { projectPath })
    return data
  },
}
