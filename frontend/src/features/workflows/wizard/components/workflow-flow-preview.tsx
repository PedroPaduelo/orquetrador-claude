import { ArrowRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { WorkflowStep } from '../../types'

interface WorkflowFlowPreviewProps {
  steps: WorkflowStep[]
}

export function WorkflowFlowPreview({ steps }: WorkflowFlowPreviewProps) {
  if (steps.length === 0) return null

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-4 px-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center shrink-0">
          {/* Step circle */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
                'bg-primary/15 text-primary border-2 border-primary/30'
              )}
            >
              {index + 1}
            </div>
            <span className="text-[11px] text-muted-foreground max-w-[80px] text-center truncate">
              {step.name || `Step ${index + 1}`}
            </span>
          </div>

          {/* Arrow connector */}
          {index < steps.length - 1 && (
            <div className="flex items-center mx-2 -mt-5">
              <div className="h-px w-6 bg-primary/30" />
              <ArrowRight className="h-3.5 w-3.5 text-primary/40 -ml-1" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
