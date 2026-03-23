import { Timer, AlertTriangle, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import type { DailyMetric } from '../api'

interface PerformanceCardsProps {
  data: DailyMetric[] | undefined
  isLoading: boolean
}

export function PerformanceCards({ data, isLoading }: PerformanceCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) return null

  // Aggregate from last 7 days
  const recent = data.slice(-7)

  // Latency (last available p50/p95)
  const lastWithLatency = [...recent].reverse().find(d => d.p50DurationMs != null)
  const p50 = lastWithLatency?.p50DurationMs
  const p95 = lastWithLatency?.p95DurationMs

  // Error breakdown (aggregate last 7 days)
  const errorAgg: Record<string, number> = {}
  for (const d of recent) {
    if (d.errorBreakdown) {
      for (const [cat, count] of Object.entries(d.errorBreakdown)) {
        errorAgg[cat] = (errorAgg[cat] || 0) + count
      }
    }
  }
  const topErrors = Object.entries(errorAgg)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  // Model breakdown (aggregate last 7 days)
  const modelAgg: Record<string, { count: number; cost: number }> = {}
  for (const d of recent) {
    if (d.modelBreakdown) {
      for (const [model, stats] of Object.entries(d.modelBreakdown)) {
        if (!modelAgg[model]) modelAgg[model] = { count: 0, cost: 0 }
        modelAgg[model].count += stats.count
        modelAgg[model].cost += stats.cost
      }
    }
  }
  const topModels = Object.entries(modelAgg)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 4)

  const errorLabels: Record<string, string> = {
    timeout: 'Timeout',
    rate_limit: 'Rate Limit',
    context_overflow: 'Context Overflow',
    budget_exceeded: 'Budget Excedido',
    tool_error: 'Erro de Tool',
    permission_denied: 'Permissão Negada',
    unknown: 'Desconhecido',
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Latency */}
      <Card>
        <div className="h-0.5 bg-gradient-to-r from-blue-500/40 via-blue-500/20 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Latência</CardTitle>
          <Timer className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          {p50 != null ? (
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">p50</span>
                <span className="text-lg font-bold">{formatDuration(p50)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">p95</span>
                <span className="text-lg font-bold text-amber-500">{formatDuration(p95 ?? 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          )}
        </CardContent>
      </Card>

      {/* Error Breakdown */}
      <Card>
        <div className="h-0.5 bg-gradient-to-r from-red-500/40 via-red-500/20 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Erros (7d)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          {topErrors.length > 0 ? (
            <div className="space-y-1.5">
              {topErrors.map(([cat, count]) => (
                <div key={cat} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{errorLabels[cat] || cat}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-500 font-medium">Nenhum erro</p>
          )}
        </CardContent>
      </Card>

      {/* Model Breakdown */}
      <Card>
        <div className="h-0.5 bg-gradient-to-r from-purple-500/40 via-purple-500/20 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Modelos (7d)</CardTitle>
          <Cpu className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          {topModels.length > 0 ? (
            <div className="space-y-1.5">
              {topModels.map(([model, stats]) => (
                <div key={model} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={model}>
                    {model.replace('claude-', '')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stats.count}x · ${stats.cost.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}
