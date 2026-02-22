import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, ChevronDown, Server, Sparkles, Bot, ScrollText } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { useWorkflowsStore } from '../store'
import { useCreateWorkflow, useUpdateWorkflow } from '../hooks/use-workflows'
import { useMcpServers } from '@/features/mcp-servers/hooks/use-mcp-servers'
import { useSkills } from '@/features/skills/hooks/use-skills'
import { useAgents } from '@/features/agents/hooks/use-agents'
import { useRules } from '@/features/rules/hooks/use-rules'
import type { WorkflowInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  type: z.enum(['sequential', 'step_by_step']),
  projectPath: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function WorkflowForm() {
  const { editingWorkflow, formSteps, isLoadingEdit, addStep, removeStep, updateStep, closeModal } =
    useWorkflowsStore()

  const createMutation = useCreateWorkflow()
  const updateMutation = useUpdateWorkflow()

  // Fetch available resources for assignment
  const { data: mcpServers } = useMcpServers()
  const { data: skills } = useSkills()
  const { data: agents } = useAgents()
  const { data: rules } = useRules()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
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

  // Re-sync form when editingWorkflow data arrives (async fetch)
  useEffect(() => {
    if (editingWorkflow && !isLoadingEdit) {
      reset({
        name: editingWorkflow.name || '',
        description: editingWorkflow.description || '',
        type: editingWorkflow.type || 'sequential',
        projectPath: editingWorkflow.projectPath || '',
      })
    }
  }, [editingWorkflow, isLoadingEdit, reset])

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
        mcpServerIds: step.mcpServerIds,
        skillIds: step.skillIds,
        agentIds: step.agentIds,
        ruleIds: step.ruleIds,
      })),
    }

    if (editingWorkflow) {
      updateMutation.mutate({ id: editingWorkflow.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  if (isLoadingEdit) {
    return (
      <div className="space-y-4 py-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Carregando dados do workflow...</span>
        </div>
      </div>
    )
  }

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
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {workflowType === 'sequential'
                ? 'Todos os steps executam automaticamente em ordem'
                : 'Você controla quando avançar para o próximo step'}
            </p>
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
                  <Label>URL Base (Claude) <span className="text-destructive">*</span></Label>
                  <Input
                    value={step.baseUrl}
                    onChange={(e) => updateStep(index, { baseUrl: e.target.value })}
                    placeholder="https://api.anthropic.com/v1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Obrigatório — endpoint da API Claude para este step</p>
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

                {/* Resource Assignment Sections */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1">
                    <ChevronDown className="h-3 w-3" />
                    <Server className="h-3 w-3" />
                    MCP Servers
                    {step.mcpServerIds.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.mcpServerIds.length}</Badge>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {mcpServers?.filter((s) => s.enabled).map((server) => (
                        <label key={server.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={step.mcpServerIds.includes(server.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked
                                ? [...step.mcpServerIds, server.id]
                                : step.mcpServerIds.filter((id) => id !== server.id)
                              updateStep(index, { mcpServerIds: ids })
                            }}
                            className="h-3.5 w-3.5"
                          />
                          {server.name}
                        </label>
                      ))}
                      {(!mcpServers || mcpServers.filter((s) => s.enabled).length === 0) && (
                        <p className="text-xs text-muted-foreground">Nenhum servidor disponivel</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1">
                    <ChevronDown className="h-3 w-3" />
                    <Sparkles className="h-3 w-3" />
                    Skills
                    {step.skillIds.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.skillIds.length}</Badge>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {skills?.filter((s) => s.enabled).map((skill) => (
                        <label key={skill.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={step.skillIds.includes(skill.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked
                                ? [...step.skillIds, skill.id]
                                : step.skillIds.filter((id) => id !== skill.id)
                              updateStep(index, { skillIds: ids })
                            }}
                            className="h-3.5 w-3.5"
                          />
                          {skill.name}
                        </label>
                      ))}
                      {(!skills || skills.filter((s) => s.enabled).length === 0) && (
                        <p className="text-xs text-muted-foreground">Nenhuma skill disponivel</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1">
                    <ChevronDown className="h-3 w-3" />
                    <Bot className="h-3 w-3" />
                    Agents
                    {step.agentIds.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.agentIds.length}</Badge>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {agents?.filter((a) => a.enabled).map((agent) => (
                        <label key={agent.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={step.agentIds.includes(agent.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked
                                ? [...step.agentIds, agent.id]
                                : step.agentIds.filter((id) => id !== agent.id)
                              updateStep(index, { agentIds: ids })
                            }}
                            className="h-3.5 w-3.5"
                          />
                          {agent.name}
                        </label>
                      ))}
                      {(!agents || agents.filter((a) => a.enabled).length === 0) && (
                        <p className="text-xs text-muted-foreground">Nenhum agent disponivel</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1">
                    <ChevronDown className="h-3 w-3" />
                    <ScrollText className="h-3 w-3" />
                    Rules
                    {step.ruleIds.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.ruleIds.length}</Badge>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {rules?.filter((r) => r.enabled).map((rule) => (
                        <label key={rule.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={step.ruleIds.includes(rule.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked
                                ? [...step.ruleIds, rule.id]
                                : step.ruleIds.filter((id) => id !== rule.id)
                              updateStep(index, { ruleIds: ids })
                            }}
                            className="h-3.5 w-3.5"
                          />
                          {rule.name}
                        </label>
                      ))}
                      {(!rules || rules.filter((r) => r.enabled).length === 0) && (
                        <p className="text-xs text-muted-foreground">Nenhuma rule disponivel</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
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
