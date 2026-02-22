import { Plus, ChevronUp, ChevronDown, Copy, Trash2, Server, Sparkles, Bot, ScrollText } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { useWorkflowsStore } from '../../store'

export function StepListSidebar() {
  const {
    formSteps,
    selectedStepIndex,
    setSelectedStepIndex,
    addStep,
    removeStep,
    moveStep,
    duplicateStep,
  } = useWorkflowsStore()

  const getResourceCount = (step: (typeof formSteps)[0]) =>
    step.mcpServerIds.length + step.skillIds.length + step.agentIds.length + step.ruleIds.length

  return (
    <TooltipProvider delayDuration={300}>
    <div className="w-[260px] border-r flex flex-col bg-muted/30">
      <div className="p-3 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Steps ({formSteps.length})
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {formSteps.map((step, index) => {
            const isSelected = index === selectedStepIndex
            const resourceCount = getResourceCount(step)

            return (
              <div
                key={index}
                onClick={() => setSelectedStepIndex(index)}
                className={cn(
                  'group rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'bg-primary/10 border border-primary/30 shadow-sm'
                    : 'hover:bg-muted/80 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2">
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
                  <span className={cn('text-sm truncate flex-1', isSelected && 'font-medium')}>
                    {step.name || `Step ${index + 1}`}
                  </span>
                </div>

                {/* Resource badges */}
                {resourceCount > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 ml-7">
                    {step.mcpServerIds.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                            <Server className="h-2.5 w-2.5" />
                            {step.mcpServerIds.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>MCP Servers</TooltipContent>
                      </Tooltip>
                    )}
                    {step.skillIds.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" />
                            {step.skillIds.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Skills</TooltipContent>
                      </Tooltip>
                    )}
                    {step.agentIds.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                            <Bot className="h-2.5 w-2.5" />
                            {step.agentIds.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Agents</TooltipContent>
                      </Tooltip>
                    )}
                    {step.ruleIds.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                            <ScrollText className="h-2.5 w-2.5" />
                            {step.ruleIds.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Rules</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}

                {/* Action buttons - show on hover or when selected */}
                <div
                  className={cn(
                    'flex items-center gap-0.5 mt-1.5 ml-5 transition-opacity',
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveStep(index, index - 1)
                        }}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mover para cima</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === formSteps.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveStep(index, index + 1)
                        }}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mover para baixo</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicateStep(index)
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicar</TooltipContent>
                  </Tooltip>

                  {formSteps.length > 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeStep(index)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remover</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="p-2 border-t">
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
