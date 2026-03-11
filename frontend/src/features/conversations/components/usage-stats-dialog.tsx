import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  Zap,
  Coins,
  Clock,
  Database,
  Info,
  Activity,
  Wrench,
  Code,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useExecutionStats } from '../hooks/use-conversations'

interface UsageStatsProps {
  conversationId: string
  steps: Array<{ id: string; name: string }>
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60000)
  const sec = ((ms % 60000) / 1000).toFixed(0)
  return `${min}m${sec}s`
}

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3 w-3 text-success" />
    case 'error':
      return <XCircle className="h-3 w-3 text-destructive" />
    case 'timeout':
      return <AlertCircle className="h-3 w-3 text-warning" />
    default:
      return <AlertCircle className="h-3 w-3 text-muted-foreground" />
  }
}

export function UsageStatsButton({ conversationId, steps }: UsageStatsProps) {
  const { data: stats, isLoading } = useExecutionStats(conversationId)
  const [open, setOpen] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  if (isLoading || !stats || stats.tokens.total === 0) {
    return null
  }

  const totalTokens = stats.tokens.total
  const costDisplay = stats.cost.totalCostUsd
    ? `$${stats.cost.totalCostUsd.toFixed(2)}`
    : stats.cost.estimatedUsd
      ? `~$${stats.cost.estimatedUsd}`
      : ''

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px] px-2"
        >
          <Zap className="h-3 w-3" />
          <span className="font-medium">{formatNumber(totalTokens)}</span>
          {costDisplay && (
            <span className="text-muted-foreground">{costDisplay}</span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Estatísticas da Conversa
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-8rem)]">
          <div className="space-y-4 pr-4">
            {/* Overview Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1">
                  <Database className="h-3 w-3" />
                  Tokens
                </div>
                <div className="text-lg font-semibold leading-tight">{formatNumber(totalTokens)}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1">
                  <Coins className="h-3 w-3" />
                  Custo
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {costDisplay || '-'}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1">
                  <Clock className="h-3 w-3" />
                  Tempo
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {formatDuration(stats.performance.totalDurationMs)}
                </div>
              </div>
            </div>

            {/* Tokens Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Tokens
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between bg-muted/30 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">Input</span>
                  <span className="font-medium">{stats.tokens.input.toLocaleString()}</span>
                </div>
                <div className="flex justify-between bg-muted/30 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-medium">{stats.tokens.output.toLocaleString()}</span>
                </div>
                <div className="flex justify-between bg-muted/30 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">Cache Criado</span>
                  <span className="font-medium">{stats.tokens.cacheCreation.toLocaleString()}</span>
                </div>
                <div className="flex justify-between bg-muted/30 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">Cache Lido</span>
                  <span className="font-medium">{stats.tokens.cacheRead.toLocaleString()}</span>
                </div>
              </div>

              {/* Token Distribution Bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(stats.tokens.input / stats.tokens.total) * 100}%` }}
                />
                <div
                  className="bg-purple-500 h-full"
                  style={{ width: `${(stats.tokens.output / stats.tokens.total) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Input {Math.round((stats.tokens.input / stats.tokens.total) * 100)}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Output {Math.round((stats.tokens.output / stats.tokens.total) * 100)}%
                </span>
              </div>
            </div>

            {/* Performance & Tools */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Performance
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duração API</span>
                    <span>{formatDuration(stats.performance.apiDurationMs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Turns</span>
                    <span>{stats.performance.numTurns}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Ferramentas
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Web Search</span>
                    <span>{stats.tools.webSearchRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Web Fetch</span>
                    <span>{stats.tools.webFetchRequests}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps Breakdown */}
            {stats.steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Steps Executados
                </h4>
                <div className="space-y-1.5">
                  {stats.steps.map((step, index) => {
                    const stepName = steps.find(s => s.id === step.stepId)?.name || step.stepName
                    const isExpanded = expandedSteps.has(step.stepId)
                    const percent = stats.tokens.total > 0 ? (step.totalTokens / stats.tokens.total) * 100 : 0
                    const isHighest = stats.steps.reduce((max, s) =>
                      s.totalTokens > max.totalTokens ? s : max
                    ).stepId === step.stepId

                    return (
                      <div key={step.stepId} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleStep(step.stepId)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-muted-foreground text-[10px] w-4">
                              {index + 1}
                            </span>
                            <span className={cn(
                              "text-xs truncate font-medium",
                              isHighest && "text-amber-600 dark:text-amber-400"
                            )} title={stepName}>
                              {stepName}
                            </span>
                            {getStatusIcon(step.resultStatus)}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-medium tabular-nums">
                              {formatNumber(step.totalTokens)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="border-t bg-muted/20 px-3 py-2 space-y-2">
                            {/* Token bar */}
                            <div className="space-y-1">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                                <div
                                  className="bg-blue-500 h-full"
                                  style={{ width: `${(step.inputTokens / step.totalTokens) * 100}%` }}
                                />
                                <div
                                  className="bg-purple-500 h-full"
                                  style={{ width: `${(step.outputTokens / step.totalTokens) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{step.inputTokens} in</span>
                                <span>{step.outputTokens} out</span>
                                <span>{percent.toFixed(1)}%</span>
                              </div>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="bg-background rounded p-1.5 text-center">
                                <div className="text-muted-foreground">Tempo</div>
                                <div className="font-medium">{formatDuration(step.durationMs)}</div>
                              </div>
                              <div className="bg-background rounded p-1.5 text-center">
                                <div className="text-muted-foreground">Ações</div>
                                <div className="font-medium">{step.actionsCount}</div>
                              </div>
                              <div className="bg-background rounded p-1.5 text-center">
                                <div className="text-muted-foreground">Status</div>
                                <div className="font-medium capitalize">{step.resultStatus}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Session Info */}
            {stats.session && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Sessão
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {stats.session.model && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Modelo: </span>
                      <span className="font-medium">{stats.session.model}</span>
                    </div>
                  )}
                  {stats.session.stopReason && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Parada: </span>
                      <span className="font-medium capitalize">{stats.session.stopReason}</span>
                    </div>
                  )}
                </div>
                {stats.session.claudeCodeVersion && (
                  <div className="text-[10px] text-muted-foreground">
                    Claude Code v{stats.session.claudeCodeVersion}
                  </div>
                )}
              </div>
            )}

            {/* Info Footer */}
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              <p>
                Tokens são contados por execução de step. Custo estimado baseado em tarifas padrão ($3/M input, $15/M output).
                Cache reduz custos em requisições subsequentes.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
