import { apiClient } from '@/shared/lib/api-client'
import type { StepTemplate, StepTemplateInput } from './types'

export const stepTemplatesApi = {
  async list(): Promise<StepTemplate[]> {
    const { data } = await apiClient.get('/step-templates')
    return data
  },

  async get(id: string): Promise<StepTemplate> {
    const { data } = await apiClient.get(`/step-templates/${id}`)
    return data
  },

  async create(input: StepTemplateInput): Promise<StepTemplate> {
    const { data } = await apiClient.post('/step-templates', input)
    return data
  },

  async update(id: string, input: Partial<StepTemplateInput>): Promise<StepTemplate> {
    const { data } = await apiClient.put(`/step-templates/${id}`, input)
    return data
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/step-templates/${id}`)
  },
}
