import { useEffect, useState } from 'react'
import { Loader2, Brain, Wifi, Zap, Square, Wrench } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { StreamingPhase } from '../store'
import { useConversationsStore } from '../store'

interface StreamingStatusProps {
  isStreaming: boolean
  phase: StreamingPhase
  onCancel: () => void
}

const PHASE_CONFIG: Record<StreamingPhase, {
  icon: typeof Loader2
  label: string
  color: string
  bgColor: string
  animate: boolean
}> = {
  idle: {
    icon: Loader2,
    label: '',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    animate: false,
  },
  preparing: {
    icon: Zap,
    label: 'Enviando para o servidor...',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    animate: true,
  },
  connecting: {
    icon: Wifi,
    label: 'Conectando com a IA...',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    animate: true,
  },
  ai_thinking: {
    icon: Brain,
    label: 'Aguardando resposta da IA...',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    animate: true,
  },
  streaming: {
    icon: Zap,
    label: 'Recebendo resposta...',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    animate: false,
  },
}

export function StreamingStatus({ isStreaming, phase, onCancel }: StreamingStatusProps) {
  const [elapsed, setElapsed] = useState(0)
  const [phaseStart, setPhaseStart] = useState(0)
  const streamingActions = useConversationsStore((s) => s.streamingActions)
  const streamingContent = useConversationsStore((s) => s.streamingContent)

  // Track total elapsed time
  useEffect(() => {
    if (!isStreaming) {
      setElapsed(0)
      return
    }

    const start = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming])

  // Track phase duration
  useEffect(() => {
    if (phase !== 'idle') {
      setPhaseStart(Date.now())
    }
  }, [phase])

  if (!isStreaming || phase === 'idle') return null

  const phaseDuration = Math.floor((Date.now() - phaseStart) / 1000)

  // Determine dynamic label for streaming phase
  const hasContent = streamingContent.length > 0
  const toolActions = streamingActions.filter(a => a.type === 'tool_use' || a.type === 'tool_result')
  const isWorking = phase === 'streaming' && !hasContent && toolActions.length > 0
  const lastTool = isWorking ? toolActions[toolActions.length - 1] : null

  // Pick the right config - override for "working" state
  const config = isWorking
    ? {
        icon: Wrench,
        label: lastTool?.name ? `IA executando: ${lastTool.name}` : 'IA executando ferramentas...',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 border-cyan-500/20',
        animate: true,
      }
    : PHASE_CONFIG[phase]

  const Icon = config.icon

  const formatTime = (secs: number) => {
    if (secs < 60) return `${secs}s`
    return `${Math.floor(secs / 60)}m ${secs % 60}s`
  }

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 border-t text-xs transition-colors',
      config.bgColor,
    )}>
      <div className="flex items-center gap-2.5">
        <Icon className={cn('h-3.5 w-3.5', config.color, config.animate && 'animate-pulse')} />
        <span className={cn('font-medium', config.color)}>
          {config.label}
        </span>

        {/* Show action count when AI is working with tools */}
        {isWorking && toolActions.length > 1 && (
          <span className="text-muted-foreground">
            ({toolActions.length} acoes executadas)
          </span>
        )}

        {/* Phase-specific elapsed time hint - only for ai_thinking when no events arrive */}
        {phase === 'ai_thinking' && phaseDuration >= 10 && (
          <span className="text-muted-foreground">
            (aguardando ha {formatTime(phaseDuration)} - a IA ainda nao respondeu)
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-muted-foreground tabular-nums">
          {formatTime(elapsed)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <Square className="h-3 w-3 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  )
}
