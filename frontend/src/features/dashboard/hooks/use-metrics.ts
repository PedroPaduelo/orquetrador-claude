import { useQuery } from '@tanstack/react-query'
import { metricsApi } from '../api'

export function useToolAnalytics() {
  return useQuery({
    queryKey: ['metrics', 'tool-analytics'],
    queryFn: () => metricsApi.getToolAnalytics(),
    staleTime: 60000,
    refetchInterval: 60000,
  })
}

export function useDailyMetrics() {
  return useQuery({
    queryKey: ['metrics', 'daily'],
    queryFn: metricsApi.getDaily,
    staleTime: 60000,
    refetchInterval: 60000,
  })
}

export function useWorkflowMetrics() {
  return useQuery({
    queryKey: ['metrics', 'by-workflow'],
    queryFn: metricsApi.getByWorkflow,
    staleTime: 60000,
    refetchInterval: 60000,
  })
}

export function useMetricAlerts() {
  return useQuery({
    queryKey: ['metrics', 'alerts'],
    queryFn: metricsApi.getAlerts,
    staleTime: 60000,
    refetchInterval: 60000,
  })
}
