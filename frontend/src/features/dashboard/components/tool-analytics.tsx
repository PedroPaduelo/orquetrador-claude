import { Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Badge } from '@/shared/components/ui/badge'
import { useToolAnalytics } from '../hooks/use-metrics'

export function ToolAnalytics() {
  const { data, isLoading } = useToolAnalytics()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) return null

  const maxCount = data[0]?.count || 1

  return (
    <Card>
      <div className="h-0.5 bg-gradient-to-r from-indigo-500/40 via-indigo-500/20 to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Tools (7 dias)
          </CardTitle>
          <Wrench className="h-4 w-4 text-indigo-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.slice(0, 10).map((tool) => (
            <div key={tool.toolName} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate max-w-[180px]" title={tool.toolName}>
                  {tool.toolName}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={tool.successRate >= 90 ? 'default' : tool.successRate >= 70 ? 'secondary' : 'destructive'}
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {tool.successRate}%
                  </Badge>
                  <span className="text-[11px] text-muted-foreground w-12 text-right">
                    {tool.count}x
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500/60 transition-all"
                  style={{ width: `${(tool.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
