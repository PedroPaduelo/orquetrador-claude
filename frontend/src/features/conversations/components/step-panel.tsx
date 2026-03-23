import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Check, Loader2, AlertCircle, RotateCcw, SkipForward, SkipBack, MessageCircle, Zap, StopCircle, Activity } from 'lucide-react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import type { WorkflowStepSummary } from '../types'
import { useConversationsStore } from '../store'
import { useAdvanceStep, useGoBackStep, useJumpToStep, useResetStepSession, useTokenUsage } from '../hooks/use-conversations'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/shared/components/ui/tooltip'
import { ExecutionTimeline } from './execution-timeline'

interface StepPanelProps {
  steps: WorkflowStepSummary[]
  currentStepIndex: number
  isExecuting: boolean
  workflowType?: 'sequential' | 'step_by_step'
  conversationId: string
}

export function StepPanel({ steps, currentStepIndex, isExecuting, workflowType, conversationId }: StepPanelProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'timeline'>('steps')
  const { stepStatuses } = useConversationsStore()
  const advanceStepMutation = useAdvanceStep(conversationId)
  const goBackStepMutation = useGoBackStep(conversationId)
  const jumpToStepMutation = useJumpToStep(conversationId)
  const resetSessionMutation = useResetStepSession(conversationId)
  const { data: tokenUsage } = useTokenUsage(conversationId)

  // Create a map of stepId -> token count for quick lookup
  const tokensByStep = new Map(tokenUsage?.steps.map(s => [s.stepId, s.totalTokens]) || [])

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

  const stepNameMap = new Map(steps.map(s => [s.id, s.name]))

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b px-2 pt-2 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors',
            activeTab === 'steps'
              ? 'bg-background border border-b-0 border-border text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Steps
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-1',
            activeTab === 'timeline'
              ? 'bg-background border border-b-0 border-border text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Activity className="h-3 w-3" />
          Timeline
        </button>
      </div>

      {activeTab === 'timeline' ? (
        <ExecutionTimeline conversationId={conversationId} stepNames={stepNameMap} />
      ) : (
      <>
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
          {tokenUsage && tokenUsage.grandTotalTokens > 0 && (
            <Badge variant="outline" className="text-[10px] px-2 h-5">
              <Zap className="h-3 w-3 mr-1" />
              {tokenUsage.grandTotalTokens >= 1000
                ? `${(tokenUsage.grandTotalTokens / 1000).toFixed(1)}k`
                : tokenUsage.grandTotalTokens} tokens
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
        <div className="p-2 space-y-0.5">
          {steps.map((step, index) => {
            const status = stepStatuses.get(step.id) || 'pending'
            const isExecutingStep = index === currentStepIndex && isExecuting
            const isCompleted = status === 'completed' || index < currentStepIndex
            const isCurrent = index === currentStepIndex
            const isActiveChat = status === 'active' && isCurrent
            const stepTokens = tokensByStep.get(step.id) || 0

            const canClick = workflowType === 'step_by_step' && !isExecuting && !isCurrent && !jumpToStepMutation.isPending

            return (
              <div
                key={step.id}
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
                onClick={() => canClick && jumpToStepMutation.mutate(step.id)}
                onKeyDown={(e) => canClick && e.key === 'Enter' && jumpToStepMutation.mutate(step.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-md transition-all duration-200 overflow-hidden',
                  isCurrent && 'bg-primary/8 border border-primary/30 shadow-sm shadow-primary/10',
                  isCompleted && !isCurrent && 'opacity-60',
                  !isCurrent && !isCompleted && 'hover:bg-muted/30',
                  canClick && 'cursor-pointer hover:bg-muted/50 active:scale-[0.98]'
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
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className={cn(
                    'text-xs font-medium truncate',
                    isCurrent && 'text-foreground',
                    isCompleted && 'text-muted-foreground',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )} title={step.name}>
                    {step.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isCompleted ? 'Concluído' :
                     isExecutingStep ? 'Executando...' :
                     isActiveChat ? 'Em conversa' :
                     status === 'cancelled' ? 'Cancelado' :
                     status === 'error' ? 'Erro' :
                     status === 'retry' ? 'Tentando novamente' :
                     'Pendente'}
                  </p>
                </div>

                {/* Token count badge */}
                {stepTokens > 0 && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded font-medium tabular-nums shrink-0',
                          isCurrent ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          {stepTokens >= 1000 ? `${(stepTokens / 1000).toFixed(1)}k` : stepTokens}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>{stepTokens.toLocaleString()} tokens usados neste step</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Reset session button (step_by_step only) */}
                {workflowType === 'step_by_step' && !isExecutingStep && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            resetSessionMutation.mutate(step.id)
                          }}
                          disabled={resetSessionMutation.isPending}
                          className={cn(
                            'p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0',
                            resetSessionMutation.isPending && 'opacity-50 pointer-events-none'
                          )}
                        >
                          {resetSessionMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Resetar sessão</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
      </>
      )}
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
  const baseClasses = 'flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 transition-all duration-200 text-[10px]'

  if (isCompleted) {
    return (
      <div className={cn(baseClasses, 'bg-success/15 border-success text-success')}>
        <Check className="h-3 w-3" />
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
        <MessageCircle className="h-3 w-3" />
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className={cn(baseClasses, 'border-muted-foreground bg-muted-foreground/10 text-muted-foreground')}>
        <StopCircle className="h-3 w-3" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={cn(baseClasses, 'border-destructive bg-destructive/10 text-destructive')}>
        <AlertCircle className="h-3 w-3" />
      </div>
    )
  }

  if (status === 'retry') {
    return (
      <div className={cn(baseClasses, 'border-warning bg-warning/10 text-warning')}>
        <RotateCcw className="h-3 w-3" />
      </div>
    )
  }

  return (
    <div className={cn(baseClasses, 'border-muted-foreground/20 text-muted-foreground')}>
      <span className="font-medium">{index + 1}</span>
    </div>
  )
}
