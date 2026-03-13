import { apiClient } from '@/shared/lib/api-client'

export interface BudgetSummary {
  dailyUsage: number
  dailyLimit: number
  monthlyUsage: number
  monthlyLimit: number
  dailyPercent: number
  monthlyPercent: number
}

export const budgetApi = {
  async getSummary(): Promise<BudgetSummary> {
    const { data } = await apiClient.get('/auth/budget')
    return data
  },
}
