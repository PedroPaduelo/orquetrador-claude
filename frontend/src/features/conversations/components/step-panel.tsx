import { cn } from '@/shared/lib/utils'
import { Check, Loader2, AlertCircle, RotateCcw, SkipForward, SkipBack, MessageCircle, Zap, StopCircle } from 'lucide-react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import type { WorkflowStepSummary } from '../types'
import { useConversationsStore } from '../store'
import { useAdvanceStep, useGoBackStep } from '../hooks/use-conversations'

interface StepPanelProps {
  steps: WorkflowStepSummary[]
  currentStepIndex: number
  isExecuting: boolean
  workflowType?: 'sequential' | 'step_by_step'
  conversationId: string
}

export function StepPanel({ steps, currentStepIndex, isExecuting, workflowType, conversationId }: StepPanelProps) {
  const { stepStatuses } = useConversationsStore()
  const advanceStepMutation = useAdvanceStep(conversationId)
  const goBackStepMutation = useGoBackStep(conversationId)

  const canAdvance = workflowType === 'step_by_step' &&
    !isExecuting &&
    currentStepIndex < steps.length - 1

  const canGoBack = workflowType === 'step_by_step' &&
    !isExecuting &&
    currentStepIndex > 0

  const isFinished = currentStepIndex >= steps.length
  const progressPercent = steps.length > 0 ? Math.round((currentStepIndex / steps.length) * 100) : 0

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
        <Zap className="h-8 w-8 mb-3 opacity-30" />
        <p className="font-medium">Nenhum step configurado</p>
        <p className="text-xs mt-1">Adicione steps ao workflow para ver o progresso aqui</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Steps</h3>
          <Badge variant="outline" className="text-[10px] px-2 h-5">
            {Math.min(currentStepIndex + 1, steps.length)}/{steps.length}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {workflowType === 'step_by_step' ? 'Passo a passo — Clique "Avançar" após concluir cada step' : 'Sequencial — Steps executam automaticamente em ordem'}
        </p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>Progresso</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 mt-2">
          {isExecuting && (
            <Badge className="text-[10px] bg-primary/15 text-primary border-0 px-2 h-5">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Executando
            </Badge>
          )}
          {isFinished && (
            <Badge className="text-[10px] bg-success/15 text-success border-0 px-2 h-5">
              <Check className="h-3 w-3 mr-1" />
              Concluído
            </Badge>
          )}
        </div>

        {/* Navigation buttons */}
        {workflowType === 'step_by_step' && (canGoBack || canAdvance) && (
          <div className="flex gap-2 mt-3">
            <Button
              className="flex-1"
              size="sm"
              variant="outline"
              onClick={() => goBackStepMutation.mutate()}
              disabled={!canGoBack || goBackStepMutation.isPending}
            >
              {goBackStepMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <SkipBack className="h-4 w-4 mr-1.5" />
              )}
              Voltar
            </Button>
            <Button
              className="flex-1"
              size="sm"
              onClick={() => advanceStepMutation.mutate()}
              disabled={!canAdvance || advanceStepMutation.isPending}
            >
              {advanceStepMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <SkipForward className="h-4 w-4 mr-1.5" />
              )}
              Avançar
            </Button>
          </div>
        )}
      </div>

      {/* Steps list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {steps.map((step, index) => {
            const status = stepStatuses.get(step.id) || 'pending'
            const isExecutingStep = index === currentStepIndex && isExecuting
            const isCompleted = status === 'completed' || index < currentStepIndex
            const isCurrent = index === currentStepIndex
            const isActiveChat = status === 'active' && isCurrent

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all duration-200',
                  isCurrent && 'bg-primary/8 border border-primary/30 shadow-sm shadow-primary/10',
                  isCompleted && !isCurrent && 'opacity-60',
                  !isCurrent && !isCompleted && 'hover:bg-muted/30'
                )}
              >
                {/* Status indicator */}
                <StepIndicator
                  index={index}
                  isCompleted={isCompleted}
                  isExecuting={isExecutingStep}
                  isActiveChat={isActiveChat}
                  status={status}
                />

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isCurrent && 'text-foreground',
                    isCompleted && 'text-muted-foreground',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )}>
                    {step.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isCompleted ? 'Concluído' :
                     isExecutingStep ? 'Executando...' :
                     isActiveChat ? 'Em conversa' :
                     status === 'cancelled' ? 'Cancelado' :
                     status === 'error' ? 'Erro' :
                     status === 'retry' ? 'Tentando novamente' :
                     'Pendente'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function StepIndicator({
  index,
  isCompleted,
  isExecuting,
  isActiveChat,
  status,
}: {
  index: number
  isCompleted: boolean
  isExecuting: boolean
  isActiveChat: boolean
  status: string
}) {
  const baseClasses = 'flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0 transition-all duration-200 text-xs'

  if (isCompleted) {
    return (
      <div className={cn(baseClasses, 'bg-success/15 border-success text-success')}>
        <Check className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (isExecuting) {
    return (
      <div className={cn(baseClasses, 'border-primary bg-primary/10')}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      </div>
    )
  }

  if (isActiveChat) {
    return (
      <div className={cn(baseClasses, 'bg-info/10 border-info text-info')}>
        <MessageCircle className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className={cn(baseClasses, 'border-muted-foreground bg-muted-foreground/10 text-muted-foreground')}>
        <StopCircle className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={cn(baseClasses, 'border-destructive bg-destructive/10 text-destructive')}>
        <AlertCircle className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (status === 'retry') {
    return (
      <div className={cn(baseClasses, 'border-warning bg-warning/10 text-warning')}>
        <RotateCcw className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <div className={cn(baseClasses, 'border-muted-foreground/20 text-muted-foreground')}>
      <span className="font-medium">{index + 1}</span>
    </div>
  )
}
