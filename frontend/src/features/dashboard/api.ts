import { apiClient } from '@/shared/lib/api-client'

export interface DailyMetric {
  date: string
  cost: number
  tokens: number
  executions: number
  errors: number
  p50DurationMs: number | null
  p95DurationMs: number | null
  errorBreakdown: Record<string, number>
  modelBreakdown: Record<string, { count: number; tokens: number; cost: number }>
}

export interface WorkflowMetric {
  workflowId: string
  name: string
  cost: number
  executions: number
  successRate: number
  avgDurationMs: number
}

export interface MetricAlert {
  type: string
  severity: 'warning' | 'danger'
  message: string
}

export interface ToolAnalytic {
  toolName: string
  count: number
  successRate: number
  avgDurationMs: number
}

export const metricsApi = {
  async getDaily(): Promise<DailyMetric[]> {
    const { data } = await apiClient.get('/metrics/daily')
    return data
  },
  async getByWorkflow(): Promise<WorkflowMetric[]> {
    const { data } = await apiClient.get('/metrics/by-workflow')
    return data
  },
  async getAlerts(): Promise<MetricAlert[]> {
    const { data } = await apiClient.get('/metrics/alerts')
    return data
  },
  async getToolAnalytics(days = 7): Promise<ToolAnalytic[]> {
    const { data } = await apiClient.get('/metrics/tool-analytics', { params: { days } })
    return data
  },
}
