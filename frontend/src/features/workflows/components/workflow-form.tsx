import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useWorkflowsStore } from '../store'
import { useCreateWorkflow, useUpdateWorkflow } from '../hooks/use-workflows'
import type { WorkflowInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  type: z.enum(['sequential', 'step_by_step']),
  projectPath: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function WorkflowForm() {
  const { editingWorkflow, formSteps, addStep, removeStep, updateStep, closeModal } =
    useWorkflowsStore()

  const createMutation = useCreateWorkflow()
  const updateMutation = useUpdateWorkflow()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingWorkflow?.name || '',
      description: editingWorkflow?.description || '',
      type: editingWorkflow?.type || 'sequential',
      projectPath: editingWorkflow?.projectPath || '',
    },
  })

  const workflowType = watch('type')

  const onSubmit = (data: FormData) => {
    const input: WorkflowInput = {
      ...data,
      steps: formSteps.map((step) => ({
        name: step.name,
        baseUrl: step.baseUrl,
        systemPrompt: step.systemPrompt,
        systemPromptNoteId: step.systemPromptNoteId,
        contextNoteIds: step.contextNoteIds,
        memoryNoteIds: step.memoryNoteIds,
        conditions: step.conditions,
        maxRetries: step.maxRetries,
      })),
    }

    if (editingWorkflow) {
      updateMutation.mutate({ id: editingWorkflow.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic info */}
      <div className="grid gap-4">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" {...register('name')} placeholder="Nome do workflow" />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Descricao</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Descricao opcional"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={workflowType}
              onValueChange={(value) => setValue('type', value as 'sequential' | 'step_by_step')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequencial</SelectItem>
                <SelectItem value="step_by_step">Passo a Passo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="projectPath">Caminho do Projeto</Label>
            <Input
              id="projectPath"
              {...register('projectPath')}
              placeholder="/caminho/do/projeto"
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Steps</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Step
          </Button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {formSteps.map((step, index) => (
            <Card key={index}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Step {index + 1}
                  </CardTitle>
                  {formSteps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-3 space-y-3">
                <div>
                  <Label>Nome do Step</Label>
                  <Input
                    value={step.name}
                    onChange={(e) => updateStep(index, { name: e.target.value })}
                    placeholder="Ex: Analise de Codigo"
                  />
                </div>

                <div>
                  <Label>URL Base (Claude)</Label>
                  <Input
                    value={step.baseUrl}
                    onChange={(e) => updateStep(index, { baseUrl: e.target.value })}
                    placeholder="https://api.anthropic.com/v1"
                  />
                </div>

                <div>
                  <Label>System Prompt</Label>
                  <Textarea
                    value={step.systemPrompt || ''}
                    onChange={(e) => updateStep(index, { systemPrompt: e.target.value })}
                    placeholder="Instrucoes para este step..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Max Retries</Label>
                  <Input
                    type="number"
                    min={0}
                    value={step.maxRetries}
                    onChange={(e) => updateStep(index, { maxRetries: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : editingWorkflow ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}
