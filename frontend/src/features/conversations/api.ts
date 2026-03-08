import { apiClient } from '@/shared/lib/api-client'
import type { Conversation, CreateConversationInput, ProjectFolder } from './types'

export const conversationsApi = {
  listFolders: async (): Promise<ProjectFolder[]> => {
    const { data } = await apiClient.get('/folders')
    return data
  },

  list: async (workflowId?: string): Promise<Conversation[]> => {
    const params = workflowId ? { workflowId } : {}
    const { data } = await apiClient.get('/conversations', { params })
    return data
  },

  get: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get(`/conversations/${id}`)
    return data
  },

  create: async (input: CreateConversationInput): Promise<Conversation> => {
    const { data } = await apiClient.post('/conversations', input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/conversations/${id}`)
  },

  clone: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/conversations/${id}/clone`, {})
    return data
  },

  cancel: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post(`/conversations/${id}/cancel`, {})
    return data
  },

  advanceStep: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/conversations/${id}/advance-step`, {})
    return data
  },

  goBackStep: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/conversations/${id}/go-back-step`, {})
    return data
  },

  jumpToStep: async (id: string, stepId: string): Promise<Conversation> => {
    const { data } = await apiClient.post(`/conversations/${id}/jump-to-step`, { stepId })
    return data
  },

  updateTitle: async (id: string, title: string): Promise<void> => {
    await apiClient.patch(`/conversations/${id}`, { title })
  },

  resetStepSession: async (conversationId: string, stepId: string): Promise<void> => {
    await apiClient.delete(`/conversations/${conversationId}/sessions/${stepId}`)
  },
}
