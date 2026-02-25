import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { StepResourceTabs } from './step-resource-tabs'
import { useWorkflowsStore } from '../../store'

export function StepDetailEditor() {
  const { formSteps, selectedStepIndex, updateStep } = useWorkflowsStore()
  const step = formSteps[selectedStepIndex]

  if (!step) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Selecione um step para editar
      </div>
    )
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
            <Label>System Prompt</Label>
            <Textarea
              value={step.systemPrompt || ''}
              onChange={(e) => updateStep(selectedStepIndex, { systemPrompt: e.target.value })}
              placeholder="Instrucoes para este step..."
              rows={3}
            />
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
        </div>

        <Separator />

        <StepResourceTabs />
      </div>
    </div>
  )
}
