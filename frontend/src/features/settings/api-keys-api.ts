import { apiClient } from '@/shared/lib/api-client'

export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
  revoked: boolean
}

export interface ApiKeyCreated {
  id: string
  name: string
  key: string
  prefix: string
  createdAt: string
}

export const apiKeysApi = {
  list: async (): Promise<ApiKeyItem[]> => {
    const { data } = await apiClient.get('/api-keys')
    return data
  },

  create: async (name: string): Promise<ApiKeyCreated> => {
    const { data } = await apiClient.post('/api-keys', { name })
    return data
  },

  revoke: async (id: string): Promise<void> => {
    await apiClient.delete(`/api-keys/${id}`)
  },
}
