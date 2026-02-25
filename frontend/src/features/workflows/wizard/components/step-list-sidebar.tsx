import { Plus, Copy, Trash2, Server, Sparkles, Bot, ScrollText } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { useWorkflowsStore } from '../../store'

export function StepListSidebar() {
  const {
    formSteps,
    selectedStepIndex,
    setSelectedStepIndex,
    addStep,
    removeStep,
    duplicateStep,
  } = useWorkflowsStore()

  const getResourceCount = (step: (typeof formSteps)[0]) =>
    step.mcpServerIds.length + step.skillIds.length + step.agentIds.length + step.ruleIds.length

  return (
    <TooltipProvider delayDuration={300}>
    <div className="w-[280px] shrink-0 border-r flex flex-col bg-muted/30 min-h-0">
      <div className="shrink-0 p-3 border-b flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Steps ({formSteps.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-1.5 space-y-0.5">
          {formSteps.map((step, index) => {
            const isSelected = index === selectedStepIndex
            const resourceCount = getResourceCount(step)

            return (
              <div
                key={index}
                onClick={() => setSelectedStepIndex(index)}
                className={cn(
                  'group rounded-md px-2 py-1.5 cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/80 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </div>
                  <span className={cn('text-xs truncate flex-1 min-w-0', isSelected && 'font-medium')}>
                    {step.name || `Step ${index + 1}`}
                  </span>

                  {/* Inline actions for selected */}
                  {isSelected && (
                    <div className="flex items-center shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicateStep(index)
                        }}
                      >
                        <Copy className="h-2.5 w-2.5" />
                      </Button>
                      {formSteps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeStep(index)
                          }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Resource badges - compact */}
                {resourceCount > 0 && (
                  <div className="flex items-center gap-1 mt-1 ml-7">
                    {step.mcpServerIds.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                        <Server className="h-2.5 w-2.5" />
                        {step.mcpServerIds.length}
                      </Badge>
                    )}
                    {step.skillIds.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        {step.skillIds.length}
                      </Badge>
                    )}
                    {step.agentIds.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                        <Bot className="h-2.5 w-2.5" />
                        {step.agentIds.length}
                      </Badge>
                    )}
                    {step.ruleIds.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                        <ScrollText className="h-2.5 w-2.5" />
                        {step.ruleIds.length}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 p-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addStep}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar Step
        </Button>
      </div>
    </div>
    </TooltipProvider>
  )
}
