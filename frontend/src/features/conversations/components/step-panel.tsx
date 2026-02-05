import { cn } from '@/shared/lib/utils'
import { Check, Loader2, AlertCircle, RotateCcw, ChevronRight, SkipForward } from 'lucide-react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import type { WorkflowStepSummary } from '../types'
import { useConversationsStore } from '../store'
import { useAdvanceStep } from '../hooks/use-conversations'

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

  const canAdvance = workflowType === 'step_by_step' &&
    !isExecuting &&
    currentStepIndex < steps.length - 1

  const isFinished = currentStepIndex >= steps.length

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Nenhum step configurado
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Steps do Workflow</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {workflowType === 'step_by_step' ? 'Execucao passo a passo' : 'Execucao sequencial'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {Math.min(currentStepIndex + 1, steps.length)} / {steps.length}
          </Badge>
          {isExecuting && (
            <Badge variant="default" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Executando
            </Badge>
          )}
          {isFinished && (
            <Badge variant="secondary" className="text-xs">
              Concluido
            </Badge>
          )}
        </div>

        {/* Botao de avancar */}
        {canAdvance && (
          <Button
            className="w-full mt-3"
            size="sm"
            onClick={() => advanceStepMutation.mutate()}
            disabled={advanceStepMutation.isPending}
          >
            {advanceStepMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4 mr-2" />
            )}
            Avancar para proximo step
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {steps.map((step, index) => {
            const status = stepStatuses.get(step.id) || 'pending'
            const isActive = index === currentStepIndex && isExecuting
            const isCompleted = status === 'completed' || index < currentStepIndex
            const isCurrent = index === currentStepIndex

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  isCurrent && 'bg-primary/10 border border-primary/20',
                  isCompleted && !isCurrent && 'bg-muted/50',
                  !isCurrent && !isCompleted && 'hover:bg-muted/30'
                )}
              >
                {/* Status indicator */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 transition-all',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isActive && 'border-primary animate-pulse',
                    status === 'error' && 'border-destructive bg-destructive/10',
                    status === 'retry' && 'border-yellow-500 bg-yellow-500/10',
                    !isCompleted && !isActive && status !== 'error' && status !== 'retry' && 'border-muted-foreground/30'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : status === 'retry' ? (
                    <RotateCcw className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isCompleted && 'text-muted-foreground'
                  )}>
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isCompleted ? 'Concluido' :
                     isActive ? 'Executando...' :
                     status === 'error' ? 'Erro' :
                     status === 'retry' ? 'Tentando novamente' :
                     'Pendente'}
                  </p>
                </div>

                {/* Arrow indicator for current */}
                {isCurrent && (
                  <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Progress summary */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span>{Math.round((currentStepIndex / steps.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStepIndex / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
