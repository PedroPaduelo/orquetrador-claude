import { useQuery } from '@tanstack/react-query'
import { budgetApi } from '../budget-api'

export function useBudget() {
  return useQuery({
    queryKey: ['token-budget'],
    queryFn: () => budgetApi.getSummary(),
    refetchInterval: 30_000,
  })
}
