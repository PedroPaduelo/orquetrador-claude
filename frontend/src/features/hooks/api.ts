import { apiClient } from '@/shared/lib/api-client'
import type { Hook, HookInput, HookTemplate, HookEventInfo } from './types'

export const hooksApi = {
  list: async (): Promise<Hook[]> => {
    const { data } = await apiClient.get('/hooks')
    return data
  },
  get: async (id: string): Promise<Hook> => {
    const { data } = await apiClient.get(`/hooks/${id}`)
    return data
  },
  create: async (input: HookInput): Promise<Hook> => {
    const { data } = await apiClient.post('/hooks', input)
    return data
  },
  update: async (id: string, input: Partial<HookInput>): Promise<Hook> => {
    const { data } = await apiClient.put(`/hooks/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/hooks/${id}`)
  },
  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/hooks/${id}/toggle`)
    return data
  },
  getTemplates: async (): Promise<HookTemplate[]> => {
    const { data } = await apiClient.get('/hooks/templates')
    return data
  },
  createFromTemplate: async (templateId: string): Promise<Hook> => {
    const { data } = await apiClient.post('/hooks/from-template', { templateId })
    return data
  },
  getEvents: async (): Promise<HookEventInfo[]> => {
    const { data } = await apiClient.get('/hooks/events')
    return data
  },
  preview: async (hookIds?: string[]): Promise<{ config: string }> => {
    const { data } = await apiClient.post('/hooks/preview', { hookIds })
    return data
  },
}
