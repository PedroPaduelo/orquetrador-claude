import { useQuery } from '@tanstack/react-query'
import { executionsApi } from '../api'

export function useExecutions(state?: string, limit = 50) {
  return useQuery({
    queryKey: ['executions', state, limit],
    queryFn: () => executionsApi.list(state, limit),
    refetchInterval: 5000,
  })
}

export function useExecutionSummary() {
  return useQuery({
    queryKey: ['executions-summary'],
    queryFn: () => executionsApi.summary(),
    refetchInterval: 5000,
  })
}
