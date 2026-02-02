import { cn } from '@/shared/lib/utils'
import { Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import type { WorkflowStepSummary } from '../types'
import { useConversationsStore } from '../store'

interface ProgressBarProps {
  steps: WorkflowStepSummary[]
  currentStepIndex: number
  isExecuting: boolean
}

export function ProgressBar({ steps, currentStepIndex, isExecuting }: ProgressBarProps) {
  const { stepStatuses } = useConversationsStore()

  if (steps.length <= 1) return null

  return (
    <div className="px-4 py-3 border-b bg-muted/30">
      <div className="flex items-center gap-1">
        {steps.map((step, index) => {
          const status = stepStatuses.get(step.id) || 'pending'
          const isActive = index === currentStepIndex && isExecuting
          const isCompleted = status === 'completed' || index < currentStepIndex

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
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
                <span className="text-xs mt-1 text-center truncate max-w-[80px]" title={step.name}>
                  {step.name}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1',
                    isCompleted || (isActive && index < currentStepIndex)
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
