import { AlertTriangle, AlertCircle } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import type { MetricAlert } from '../api'

interface AlertsPanelProps {
  alerts: MetricAlert[] | undefined
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (!alerts || alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => (
        <div
          key={`${alert.type}-${index}`}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            alert.severity === 'danger'
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-amber-500/5 border-amber-500/20'
          }`}
        >
          {alert.severity === 'danger' ? (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm">{alert.message}</p>
          </div>
          <Badge
            variant={alert.severity === 'danger' ? 'destructive' : 'outline'}
            className={
              alert.severity === 'warning'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                : ''
            }
          >
            {alert.severity === 'danger' ? 'Critico' : 'Aviso'}
          </Badge>
        </div>
      ))}
    </div>
  )
}
