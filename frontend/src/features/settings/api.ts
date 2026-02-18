import { apiClient } from '@/shared/lib/api-client'
import type { AppSettings } from './types'

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await apiClient.get('/settings')
    return data
  },

  update: async (input: Partial<AppSettings>): Promise<AppSettings> => {
    const { data } = await apiClient.put('/settings', input)
    return data
  },
}
