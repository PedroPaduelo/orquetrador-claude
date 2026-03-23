import { Coins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useBudget } from '@/features/settings/hooks/use-budget'

function ProgressBar({ percent, label, usage, limit }: { percent: number; label: string; usage: number; limit: number }) {
  const color = percent >= 100
    ? 'bg-red-500'
    : percent >= 80
      ? 'bg-amber-500'
      : 'bg-emerald-500'

  const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(n)

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatTokens(usage)} / {formatTokens(limit)} ({percent}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}

export function TokenBudgetBar() {
  const { data: budget, isLoading } = useBudget()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  if (!budget) return null

  return (
    <Card>
      <div className="h-0.5 bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-transparent" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Token Budget</CardTitle>
        <Coins className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent className="space-y-3">
        <ProgressBar
          label="Diário"
          percent={budget.dailyPercent}
          usage={budget.dailyUsage}
          limit={budget.dailyLimit}
        />
        <ProgressBar
          label="Mensal"
          percent={budget.monthlyPercent}
          usage={budget.monthlyUsage}
          limit={budget.monthlyLimit}
        />
      </CardContent>
    </Card>
  )
}
