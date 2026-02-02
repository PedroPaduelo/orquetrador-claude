import { apiClient } from '@/shared/lib/api-client'
import type { Conversation, CreateConversationInput, Message } from './types'

export const conversationsApi = {
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

  cancel: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post(`/conversations/${id}/cancel`)
    return data
  },

  getStatus: async (id: string): Promise<{ isExecuting: boolean }> => {
    const { data } = await apiClient.get(`/conversations/${id}/status`)
    return data
  },

  getMessages: async (id: string, stepId?: string): Promise<Message[]> => {
    const params = stepId ? { stepId } : {}
    const { data } = await apiClient.get(`/conversations/${id}/messages`, { params })
    return data
  },

  toggleMessageContext: async (messageId: string, selected: boolean): Promise<void> => {
    await apiClient.put(`/messages/${messageId}/select`, { selected })
  },

  updateMessageActions: async (messageId: string, actions: unknown[]): Promise<void> => {
    await apiClient.put(`/messages/${messageId}/actions`, { actions })
  },
}
