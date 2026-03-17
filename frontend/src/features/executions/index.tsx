import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Circle,
  Pause,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  ExternalLink,
  RefreshCw,
  Timer,
  Square,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { cn, formatRelativeTime } from '@/shared/lib/utils'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { EmptyState } from '@/shared/components/common/empty-state'
import { useExecutions, useExecutionSummary } from './hooks/use-executions'
import { useCancelExecution } from '@/features/conversations/hooks/use-conversations'
import type { Execution } from './api'

const STATE_CONFIG: Record<string, {
  label: string
  icon: typeof Circle
  color: string
  badgeClass: string
}> = {
  running: {
    label: 'Rodando',
    icon: Activity,
    color: 'text-amber-500',
    badgeClass: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
  },
  paused: {
    label: 'Pausado',
    icon: Pause,
    color: 'text-blue-500',
    badgeClass: 'border-blue-500/30 text-blue-500 bg-blue-500/10',
  },
  queued: {
    label: 'Na fila',
    icon: Clock,
    color: 'text-muted-foreground',
    badgeClass: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
  },
  completed: {
    label: 'Concluido',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    badgeClass: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    color: 'text-destructive',
    badgeClass: 'border-destructive/30 text-destructive bg-destructive/10',
  },
  cancelled: {
    label: 'Cancelado',
    icon: Ban,
    color: 'text-muted-foreground',
    badgeClass: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
  },
}

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'running', label: 'Rodando' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'completed', label: 'Concluidas' },
  { key: 'failed', label: 'Falhas' },
] as const

function formatDuration(startedAt: string, endedAt?: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function getEndTime(exec: Execution): string | null {
  return exec.completedAt || exec.failedAt || exec.cancelledAt || null
}

function StopButton({ conversationId }: { conversationId: string }) {
  const cancel = useCancelExecution(conversationId)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
      title="Parar execucao"
      disabled={cancel.isPending}
      onClick={(e) => {
        e.stopPropagation()
        cancel.mutate()
      }}
    >
      <Square className={cn('h-3.5 w-3.5 fill-current', cancel.isPending && 'animate-pulse')} />
    </Button>
  )
}

export default function ExecutionsPage() {
  const navigate = useNavigate()
  const [stateFilter, setStateFilter] = useState('')
  const { data: executions, isLoading, dataUpdatedAt } = useExecutions(stateFilter || undefined, 100)
  const { data: summary } = useExecutionSummary()

  return (
    <div className="container py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Execucoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe as execucoes dos seus workflows em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin opacity-40" />
          <span>Auto-refresh 5s</span>
          {dataUpdatedAt > 0 && (
            <span>· {formatRelativeTime(new Date(dataUpdatedAt))}</span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATE_CONFIG).map(([key, config]) => {
            const count = summary[key as keyof typeof summary] || 0
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => setStateFilter(stateFilter === key ? '' : key)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  stateFilter === key
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'hover:bg-muted/50',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', config.color)} />
                <div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {config.label}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStateFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              stateFilter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {summary && tab.key && (
              <span className="ml-1.5 text-xs opacity-60">
                ({summary[tab.key as keyof typeof summary] || 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Execution list */}
      {isLoading ? (
        <ListSkeleton count={6} />
      ) : executions && executions.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversa</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Workflow</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Step</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    Duracao
                  </div>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Inicio</th>
                <th className="text-right px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {executions.map((exec, index) => {
                const config = STATE_CONFIG[exec.state] || STATE_CONFIG.queued
                const Icon = config.icon
                const isActive = exec.state === 'running'
                const endTime = getEndTime(exec)

                return (
                  <tr
                    key={exec.id}
                    className={cn(
                      'border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in-up',
                      isActive && 'bg-amber-500/5',
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => navigate(`/conversations/${exec.conversationId}`)}
                  >
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] gap-1', config.badgeClass)}
                      >
                        <Icon className={cn('h-3 w-3', isActive && 'animate-pulse')} />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium truncate block max-w-[250px]">
                        {exec.conversationTitle || 'Sem titulo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                        {exec.workflowName}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        Step {exec.currentStepIndex + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={cn(
                        'text-xs font-mono',
                        isActive ? 'text-amber-500' : 'text-muted-foreground',
                      )}>
                        {formatDuration(exec.startedAt, endTime)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(exec.startedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(exec.state === 'running' || exec.state === 'paused') && (
                          <StopButton conversationId={exec.conversationId} />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/conversations/${exec.conversationId}`)
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="Nenhuma execucao encontrada"
          description={stateFilter ? 'Nenhuma execucao com esse status.' : 'As execucoes aparecerao aqui quando voce iniciar uma conversa.'}
          action={
            stateFilter ? (
              <Button variant="outline" onClick={() => setStateFilter('')}>
                Ver todas
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Error details for failed executions */}
      {executions && stateFilter === 'failed' && executions.some(e => e.error) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Detalhes dos erros</h3>
          {executions.filter(e => e.error).map((exec) => (
            <div
              key={exec.id}
              className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm cursor-pointer hover:bg-destructive/10 transition-colors"
              onClick={() => navigate(`/conversations/${exec.conversationId}`)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs">
                  {exec.conversationTitle || 'Sem titulo'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(exec.failedAt || exec.updatedAt)}
                </span>
              </div>
              <p className="text-xs text-destructive/80 font-mono line-clamp-2">
                {exec.error}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
