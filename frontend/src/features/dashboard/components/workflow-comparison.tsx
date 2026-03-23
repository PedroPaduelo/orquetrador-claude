import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import type { WorkflowMetric } from '../api'

interface WorkflowComparisonProps {
  data: WorkflowMetric[] | undefined
  isLoading: boolean
}

export function WorkflowComparison({ data, isLoading }: WorkflowComparisonProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Comparativo por Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Comparativo por Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Sem dados de workflows ainda
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    shortName: d.name.length > 15 ? `${d.name.slice(0, 15)}...` : d.name,
    successPct: Math.round(d.successRate * 100),
  }))

  return (
    <Card>
      <div className="h-0.5 bg-gradient-to-r from-blue-500/40 via-blue-500/20 to-transparent" />
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Comparativo por Workflow
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value, name) => {
                  const v = value as number
                  if (name === 'executions') return [v, 'Execucoes']
                  if (name === 'successPct') return [`${v}%`, 'Taxa Sucesso']
                  return [v, String(name)]
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="executions"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="right"
                dataKey="successPct"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span className="text-xs text-muted-foreground">Execucoes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Taxa Sucesso</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
