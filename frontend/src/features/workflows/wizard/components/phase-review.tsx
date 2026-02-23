import { Pencil, Server, Sparkles, Bot, ScrollText, GitBranch } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { WorkflowFlowPreview } from './workflow-flow-preview'
import { useWorkflowsStore } from '../../store'

interface PhaseReviewProps {
  onEditPhase: (phase: 1 | 2) => void
}

export function PhaseReview({ onEditPhase }: PhaseReviewProps) {
  const { basicInfo, formSteps } = useWorkflowsStore()

  const totalResources = formSteps.reduce(
    (acc, step) =>
      acc +
      step.mcpServerIds.length +
      step.skillIds.length +
      step.agentIds.length +
      step.ruleIds.length,
    0
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Revisao</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confira as configuracoes antes de salvar.
        </p>
      </div>

      {/* Workflow Summary Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">{basicInfo.name}</h3>
              {basicInfo.description && (
                <p className="text-sm text-muted-foreground">{basicInfo.description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={
                    basicInfo.type === 'sequential'
                      ? 'border-primary/30 text-primary bg-primary/5'
                      : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                  }
                >
                  {basicInfo.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>{formSteps.length} steps</span>
                </div>
                {totalResources > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    <span>{totalResources} recursos</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditPhase(1)}
              className="shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Flow Preview */}
      <Card>
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold mb-2">Fluxo</h4>
          <WorkflowFlowPreview steps={formSteps} />
        </CardContent>
      </Card>

      {/* Step Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Detalhes dos Steps</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditPhase(2)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar Steps
          </Button>
        </div>

        {formSteps.map((step, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <h5 className="text-sm font-medium">
                      {step.name || `Step ${index + 1}`}
                    </h5>
                    <p className="text-xs text-muted-foreground truncate">
                      {step.baseUrl || 'URL nao definida'}
                    </p>
                  </div>

                  {step.systemPrompt && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/50 rounded px-2 py-1.5">
                      {step.systemPrompt}
                    </p>
                  )}

                  {/* Resource summary */}
                  {(step.mcpServerIds.length > 0 ||
                    step.skillIds.length > 0 ||
                    step.agentIds.length > 0 ||
                    step.ruleIds.length > 0) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {step.mcpServerIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Server className="h-2.5 w-2.5" />
                          {step.mcpServerIds.length} MCP
                        </Badge>
                      )}
                      {step.skillIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          {step.skillIds.length} Skills
                        </Badge>
                      )}
                      {step.agentIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Bot className="h-2.5 w-2.5" />
                          {step.agentIds.length} Agents
                        </Badge>
                      )}
                      {step.ruleIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <ScrollText className="h-2.5 w-2.5" />
                          {step.ruleIds.length} Rules
                        </Badge>
                      )}
                    </div>
                  )}

                  {step.maxRetries > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Max retries: {step.maxRetries}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
