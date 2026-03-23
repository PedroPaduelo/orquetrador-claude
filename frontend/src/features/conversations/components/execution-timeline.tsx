import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Clock, Zap, AlertCircle, Check, ChevronDown, ChevronRight, Activity, Code, Search, Globe } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/shared/components/ui/tooltip'
import { useConversationTraces, useTraceDetail } from '../hooks/use-traces'
import type { ParsedEvent } from '../api/traces.api'

interface ExecutionTimelineProps {
  conversationId: string
  stepNames: Map<string, string>
}

export function ExecutionTimeline({ conversationId, stepNames }: ExecutionTimelineProps) {
  const { data: traces, isLoading } = useConversationTraces(conversationId)
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!traces || traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
        <Activity className="h-8 w-8 mb-3 opacity-30" />
        <p className="font-medium">Nenhuma execução registrada</p>
        <p className="text-xs mt-1">Envie uma mensagem para iniciar a execução</p>
      </div>
    )
  }

  // Group traces by executionId
  const execGroups = new Map<string, typeof traces>()
  for (const trace of traces) {
    const group = execGroups.get(trace.executionId) || []
    group.push(trace)
    execGroups.set(trace.executionId, group)
  }

  // Find max duration for scaling bars
  const maxDuration = Math.max(...traces.map(t => t.durationMs ?? 0), 1)

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {Array.from(execGroups.entries()).map(([execId, groupTraces]) => {
          const totalDuration = groupTraces.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
          const hasError = groupTraces.some(t => t.resultStatus === 'error' || t.resultStatus === 'timeout')
          const allSuccess = groupTraces.every(t => t.resultStatus === 'success' || t.resultStatus === 'needs_input')

          return (
            <div key={execId} className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                <span className="font-mono truncate">{execId.slice(0, 20)}...</span>
                <span className="text-border">|</span>
                <span>{formatDuration(totalDuration)}</span>
                {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
                {allSuccess && <Check className="h-3 w-3 text-success" />}
              </div>

              {groupTraces.map(trace => (
                <TraceRow
                  key={trace.id}
                  traceId={trace.id}
                  stepName={stepNames.get(trace.stepId) || trace.stepId.slice(0, 8)}
                  resultStatus={trace.resultStatus}
                  durationMs={trace.durationMs}
                  maxDuration={maxDuration}
                  actionsCount={trace.actionsCount}
                  errorMessage={trace.errorMessage}
                  isExpanded={expandedTrace === trace.id}
                  onToggle={() => setExpandedTrace(expandedTrace === trace.id ? null : trace.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function TraceRow({
  traceId,
  stepName,
  resultStatus,
  durationMs,
  maxDuration,
  actionsCount,
  errorMessage,
  isExpanded,
  onToggle,
}: {
  traceId: string
  stepName: string
  resultStatus: string
  durationMs: number | null
  maxDuration: number
  actionsCount: number
  errorMessage: string | null
  isExpanded: boolean
  onToggle: () => void
}) {
  const barWidth = durationMs ? Math.max(4, (durationMs / maxDuration) * 100) : 4

  return (
    <div className="group">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
          'hover:bg-muted/50',
          isExpanded && 'bg-muted/30'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}

        <StatusDot status={resultStatus} />

        <span className="text-xs font-medium truncate min-w-0 flex-shrink" title={stepName}>
          {stepName}
        </span>

        {/* Waterfall bar */}
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                resultStatus === 'success' || resultStatus === 'needs_input'
                  ? 'bg-primary/60'
                  : resultStatus === 'error' || resultStatus === 'timeout'
                    ? 'bg-destructive/60'
                    : 'bg-muted-foreground/40'
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actionsCount > 0 && (
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {actionsCount} ações
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums w-14 text-right">
            {formatDuration(durationMs ?? 0)}
          </span>
        </div>
      </button>

      {isExpanded && (
        <TraceDetailPanel traceId={traceId} errorMessage={errorMessage} />
      )}
    </div>
  )
}

function TraceDetailPanel({ traceId, errorMessage }: { traceId: string; errorMessage: string | null }) {
  const { data: detail, isLoading } = useTraceDetail(traceId)

  if (isLoading) {
    return (
      <div className="ml-7 p-2 space-y-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!detail) return null

  const events = (detail.parsedEvents || []) as ParsedEvent[]
  const actions = events.filter(e => e.k === 'action')
  const errors = events.filter(e => e.k === 'error')
  const usageEvents = events.filter(e => e.k === 'usage')
  const totalIn = usageEvents.reduce((s, e) => s + (e.d?.in ?? 0), 0)
  const totalOut = usageEvents.reduce((s, e) => s + (e.d?.out ?? 0), 0)

  return (
    <div className="ml-7 mr-2 mb-2 p-2 bg-muted/20 rounded-md border border-border/50 space-y-2">
      {/* Metadata row */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {detail.model && (
          <Badge variant="outline" className="h-4 text-[9px] px-1.5">
            {detail.model}
          </Badge>
        )}
        {(totalIn > 0 || totalOut > 0) && (
          <Badge variant="outline" className="h-4 text-[9px] px-1.5">
            <Zap className="h-2.5 w-2.5 mr-0.5" />
            {formatTokens(totalIn)}↓ {formatTokens(totalOut)}↑
          </Badge>
        )}
        {detail.exitCode !== null && detail.exitCode !== 0 && (
          <Badge variant="destructive" className="h-4 text-[9px] px-1.5">
            exit {detail.exitCode}
          </Badge>
        )}
        {detail.errorCategory && (
          <Badge variant="destructive" className="h-4 text-[9px] px-1.5">
            {detail.errorCategory}
          </Badge>
        )}
      </div>

      {/* Actions timeline */}
      {actions.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground">Ações ({actions.length})</p>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {actions.slice(0, 20).map((action, i) => (
              <EventRow key={i} event={action} />
            ))}
            {actions.length > 20 && (
              <p className="text-[9px] text-muted-foreground pl-4">
                + {actions.length - 20} mais...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {(errors.length > 0 || errorMessage) && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-destructive">Erros</p>
          {errorMessage && (
            <p className="text-[9px] text-destructive/80 bg-destructive/5 rounded px-2 py-1 truncate" title={errorMessage}>
              {errorMessage}
            </p>
          )}
          {errors.map((err, i) => (
            <p key={i} className="text-[9px] text-destructive/80 pl-4 truncate" title={String(err.d?.msg)}>
              {formatTime(err.t)} — {err.d?.msg}
            </p>
          ))}
        </div>
      )}

      {/* Timing */}
      <div className="flex gap-3 text-[9px] text-muted-foreground">
        {detail.firstByteAt && (
          <span>
            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
            TTFB: {formatDuration(new Date(detail.firstByteAt).getTime() - new Date(detail.startedAt).getTime())}
          </span>
        )}
        {detail.firstContentAt && (
          <span>
            TTFC: {formatDuration(new Date(detail.firstContentAt).getTime() - new Date(detail.startedAt).getTime())}
          </span>
        )}
        <span>
          Total: {formatDuration(detail.durationMs ?? 0)}
        </span>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: ParsedEvent }) {
  const actionType = event.d?.type || event.d?.name || event.k
  const icon = getActionIcon(actionType)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-muted/30">
            {icon}
            <span className="text-[9px] text-muted-foreground tabular-nums w-12">
              {formatTime(event.t)}
            </span>
            <span className="text-[9px] font-medium truncate">
              {event.d?.name || event.d?.type || event.k}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <pre className="text-[10px] whitespace-pre-wrap">{JSON.stringify(event.d, null, 2)}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className={cn(
      'w-2 h-2 rounded-full shrink-0',
      status === 'success' || status === 'needs_input' ? 'bg-success' :
      status === 'error' || status === 'timeout' ? 'bg-destructive' :
      status === 'cancelled' || status === 'interrupted' ? 'bg-warning' :
      'bg-muted-foreground'
    )} />
  )
}

function getActionIcon(type: string) {
  const cls = 'h-2.5 w-2.5 text-muted-foreground shrink-0'
  if (type === 'Bash' || type === 'bash') return <Code className={cls} />
  if (type === 'WebSearch' || type === 'web_search') return <Search className={cls} />
  if (type === 'WebFetch' || type === 'web_fetch') return <Globe className={cls} />
  return <Zap className={cls} />
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min}m${sec}s`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
