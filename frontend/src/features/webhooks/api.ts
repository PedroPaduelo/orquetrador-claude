import { apiClient } from '@/shared/lib/api-client'

export interface Webhook {
  id: string
  url: string
  events: string[]
  secret?: string
  enabled: boolean
  deliveryCount: number
  createdAt: string
  updatedAt: string
}

export interface WebhookInput {
  url: string
  events: string[]
  secret?: string
  enabled?: boolean
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  statusCode: number | null
  success: boolean
  requestBody: string
  responseBody: string | null
  error: string | null
  createdAt: string
}

export const webhooksApi = {
  async list(): Promise<Webhook[]> {
    const { data } = await apiClient.get('/webhooks')
    return data
  },

  async get(id: string): Promise<Webhook> {
    const { data } = await apiClient.get(`/webhooks/${id}`)
    return data
  },

  async create(input: WebhookInput): Promise<Webhook> {
    const { data } = await apiClient.post('/webhooks', input)
    return data
  },

  async update(id: string, input: Partial<WebhookInput>): Promise<Webhook> {
    const { data } = await apiClient.put(`/webhooks/${id}`, input)
    return data
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/webhooks/${id}`)
  },

  async toggle(id: string): Promise<Webhook> {
    const { data } = await apiClient.patch(`/webhooks/${id}/toggle`)
    return data
  },

  async listDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const { data } = await apiClient.get(`/webhooks/${webhookId}/deliveries`)
    return data
  },
}
