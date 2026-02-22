import { useEffect, useState } from 'react'
import { Loader2, Brain, Wifi, Zap, Square } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { StreamingPhase } from '../store'

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
    label: 'IA processando sua mensagem...',
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

  const config = PHASE_CONFIG[phase]
  const Icon = config.icon
  const phaseDuration = Math.floor((Date.now() - phaseStart) / 1000)

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

        {/* Phase-specific elapsed time hint */}
        {phase === 'ai_thinking' && phaseDuration >= 3 && (
          <span className="text-muted-foreground">
            (aguardando ha {formatTime(phaseDuration)} - isso e normal, a IA esta analisando)
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
