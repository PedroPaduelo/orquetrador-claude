import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface WizardStepperProps {
  currentPhase: 1 | 2 | 3
  onPhaseClick: (phase: 1 | 2 | 3) => void
  completedPhases: number[]
}

const phases = [
  { number: 1 as const, label: 'Informacoes Basicas' },
  { number: 2 as const, label: 'Steps' },
  { number: 3 as const, label: 'Revisao' },
]

export function WizardStepper({ currentPhase, onPhaseClick, completedPhases }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-3 px-4 border-b shrink-0">
      {phases.map((phase, i) => {
        const isCompleted = completedPhases.includes(phase.number)
        const isCurrent = currentPhase === phase.number
        const isClickable = isCompleted || isCurrent

        return (
          <div key={phase.number} className="flex items-center">
            {/* Step circle + label */}
            <button
              type="button"
              onClick={() => isClickable && onPhaseClick(phase.number)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2.5 group transition-all duration-200',
                isClickable ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 shrink-0',
                  isCurrent && 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-4 ring-primary/10',
                  isCompleted && !isCurrent && 'bg-primary/15 text-primary',
                  !isCurrent && !isCompleted && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="h-4 w-4" />
                ) : (
                  phase.number
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium transition-colors whitespace-nowrap',
                  isCurrent && 'text-foreground',
                  isCompleted && !isCurrent && 'text-primary',
                  !isCurrent && !isCompleted && 'text-muted-foreground'
                )}
              >
                {phase.label}
              </span>
            </button>

            {/* Connector line */}
            {i < phases.length - 1 && (
              <div
                className={cn(
                  'h-px w-16 mx-4 transition-colors duration-200',
                  completedPhases.includes(phase.number)
                    ? 'bg-primary/40'
                    : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
