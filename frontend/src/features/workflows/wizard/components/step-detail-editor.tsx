import { useState } from 'react'
import { History } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { StepResourceTabs } from './step-resource-tabs'
import { ValidatorConfigPanel } from './validator-config-panel'
import { VariableConfigPanel } from './variable-config-panel'
import { PromptHistoryDialog } from '../../components/prompt-history-dialog'
import { useWorkflowsStore } from '../../store'

export function StepDetailEditor() {
  const { formSteps, selectedStepIndex, updateStep, editingWorkflow } = useWorkflowsStore()
  const step = formSteps[selectedStepIndex]
  const [promptHistoryOpen, setPromptHistoryOpen] = useState(false)

  if (!step) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Selecione um step para editar
      </div>
    )
  }

  // Other steps for dependsOn selection (exclude self)
  const otherSteps = formSteps
    .map((s, i) => ({ name: s.name || `Step ${i + 1}`, index: i, id: s.id }))
    .filter((_, i) => i !== selectedStepIndex)

  const toggleDependsOn = (stepId: string) => {
    const current = step.dependsOn || []
    const updated = current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId]
    updateStep(selectedStepIndex, { dependsOn: updated })
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">
            Step {selectedStepIndex + 1}
            {step.name && (
              <span className="font-normal text-muted-foreground ml-1.5">
                — {step.name}
              </span>
            )}
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Nome do Step</Label>
            <Input
              value={step.name}
              onChange={(e) => updateStep(selectedStepIndex, { name: e.target.value })}
              placeholder="Ex: Analise de Codigo"
            />
          </div>

          <div>
            <Label>
              URL Base (Claude) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={step.baseUrl}
              onChange={(e) => updateStep(selectedStepIndex, { baseUrl: e.target.value })}
              placeholder="https://api.anthropic.com/v1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Endpoint da API Claude para este step
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>System Prompt</Label>
              {editingWorkflow && step.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setPromptHistoryOpen(true)}
                >
                  <History className="h-3 w-3" />
                  Historico
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Switch
                id={`use-base-prompt-${selectedStepIndex}`}
                checked={step.useBasePrompt !== false}
                onCheckedChange={(checked) =>
                  updateStep(selectedStepIndex, { useBasePrompt: checked })
                }
              />
              <Label
                htmlFor={`use-base-prompt-${selectedStepIndex}`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Incluir prompt base do sistema
              </Label>
            </div>
            <Textarea
              value={step.systemPrompt || ''}
              onChange={(e) => updateStep(selectedStepIndex, { systemPrompt: e.target.value })}
              placeholder={
                step.useBasePrompt !== false
                  ? 'Instrucoes adicionais para este step (sera combinado com o prompt base)...'
                  : 'Instrucoes completas para este step (sem prompt base)...'
              }
              rows={3}
            />
            {step.useBasePrompt === false && (
              <p className="text-[11px] text-amber-500 mt-1">
                Prompt base desativado — apenas o system prompt acima sera usado.
              </p>
            )}
          </div>

          <div className="w-32">
            <Label>Max Retries</Label>
            <Input
              type="number"
              min={0}
              value={step.maxRetries}
              onChange={(e) =>
                updateStep(selectedStepIndex, { maxRetries: parseInt(e.target.value) || 0 })
              }
            />
          </div>

          {/* Dependencies (DAG) */}
          {otherSteps.length > 0 && (
            <div>
              <Label className="mb-2 block">Depende de (DAG)</Label>
              <div className="flex flex-wrap gap-1.5">
                {otherSteps.map((s) => {
                  const depId = s.id || String(s.index)
                  const isSelected = (step.dependsOn || []).includes(depId)
                  return (
                    <Badge
                      key={s.index}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors text-xs"
                      onClick={() => toggleDependsOn(depId)}
                    >
                      {s.name}
                    </Badge>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Steps que devem completar antes deste executar
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Validators */}
        <ValidatorConfigPanel
          validators={step.validators || []}
          onChange={(validators) => updateStep(selectedStepIndex, { validators })}
        />

        <Separator />

        {/* Variables */}
        <VariableConfigPanel
          inputVariables={step.inputVariables || []}
          outputVariables={step.outputVariables || []}
          onInputChange={(inputVariables) => updateStep(selectedStepIndex, { inputVariables })}
          onOutputChange={(outputVariables) => updateStep(selectedStepIndex, { outputVariables })}
        />

        <Separator />

        <StepResourceTabs />
      </div>

      {/* Prompt History Dialog */}
      {editingWorkflow && step.id && (
        <PromptHistoryDialog
          open={promptHistoryOpen}
          onOpenChange={setPromptHistoryOpen}
          workflowId={editingWorkflow.id}
          stepId={step.id}
        />
      )}
    </div>
  )
}
