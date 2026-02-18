import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { useAgentsStore } from '../store'
import { useCreateAgent, useUpdateAgent } from '../hooks/use-agents'
import type { AgentInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  model: z.string().optional(),
  permissionMode: z.string(),
  maxTurns: z.coerce.number().min(0).optional().or(z.literal('')),
  toolsStr: z.string().optional(),
  disallowedToolsStr: z.string().optional(),
  skillsStr: z.string().optional(),
  systemPrompt: z.string().optional(),
  isGlobal: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export function AgentForm() {
  const { editingAgent, isLoadingEdit, closeModal } = useAgentsStore()
  const createMutation = useCreateAgent()
  const updateMutation = useUpdateAgent()

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
      name: editingAgent?.name || '',
      description: editingAgent?.description || '',
      model: editingAgent?.model || '',
      permissionMode: editingAgent?.permissionMode || 'default',
      maxTurns: editingAgent?.maxTurns ?? '',
      toolsStr: editingAgent?.tools ? editingAgent.tools.join(', ') : '',
      disallowedToolsStr: editingAgent?.disallowedTools ? editingAgent.disallowedTools.join(', ') : '',
      skillsStr: editingAgent?.skills ? editingAgent.skills.join(', ') : '',
      systemPrompt: editingAgent?.systemPrompt || '',
      isGlobal: editingAgent?.isGlobal ?? true,
    },
  })

  // Re-sync form when full agent data arrives
  useEffect(() => {
    if (editingAgent && !isLoadingEdit) {
      reset({
        name: editingAgent.name || '',
        description: editingAgent.description || '',
        model: editingAgent.model || '',
        permissionMode: editingAgent.permissionMode || 'default',
        maxTurns: editingAgent.maxTurns ?? '',
        toolsStr: editingAgent.tools ? editingAgent.tools.join(', ') : '',
        disallowedToolsStr: editingAgent.disallowedTools ? editingAgent.disallowedTools.join(', ') : '',
        skillsStr: editingAgent.skills ? editingAgent.skills.join(', ') : '',
        systemPrompt: editingAgent.systemPrompt || '',
        isGlobal: editingAgent.isGlobal ?? true,
      })
    }
  }, [editingAgent, isLoadingEdit, reset])

  const permissionMode = watch('permissionMode')

  const parseCommaList = (str?: string): string[] =>
    str ? str.split(',').map((s) => s.trim()).filter(Boolean) : []

  const onSubmit = (data: FormData) => {
    const input: AgentInput = {
      name: data.name,
      description: data.description,
      model: data.model || undefined,
      permissionMode: data.permissionMode,
      maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : undefined,
      tools: parseCommaList(data.toolsStr),
      disallowedTools: parseCommaList(data.disallowedToolsStr),
      skills: parseCommaList(data.skillsStr),
      systemPrompt: data.systemPrompt,
      isGlobal: data.isGlobal,
    }

    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, input })
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
          <span className="text-sm">Carregando dados do agent...</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identidade */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identidade</h3>
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" {...register('name')} placeholder="meu-agente" />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="description">Descricao</Label>
          <Textarea id="description" {...register('description')} placeholder="Descricao opcional" rows={2} />
        </div>
      </div>

      {/* Configuracao */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configuracao</h3>
        <div>
          <Label htmlFor="model">Modelo (opcional)</Label>
          <Input id="model" {...register('model')} placeholder="claude-sonnet-4-20250514" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Modo de Permissao</Label>
            <Select value={permissionMode} onValueChange={(v) => setValue('permissionMode', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="plan">Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="maxTurns">Max Turnos</Label>
            <Input id="maxTurns" type="number" {...register('maxTurns')} placeholder="10" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isGlobal')} className="rounded" />
            <span className="text-sm">Global</span>
          </label>
        </div>
      </div>

      {/* Ferramentas */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ferramentas</h3>
        <div>
          <Label htmlFor="toolsStr">Ferramentas (separadas por virgula)</Label>
          <Input id="toolsStr" {...register('toolsStr')} placeholder="Read, Write, Bash" />
        </div>
        <div>
          <Label htmlFor="disallowedToolsStr">Ferramentas Bloqueadas (separadas por virgula)</Label>
          <Input id="disallowedToolsStr" {...register('disallowedToolsStr')} placeholder="WebSearch" />
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Skills</h3>
        <div>
          <Label htmlFor="skillsStr">Skills (separadas por virgula)</Label>
          <Input id="skillsStr" {...register('skillsStr')} placeholder="skill-1, skill-2" />
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">System Prompt</h3>
        <div>
          <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
          <Textarea id="systemPrompt" {...register('systemPrompt')} placeholder="Voce e um agente especializado em..." rows={8} className="font-mono text-sm" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : editingAgent ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}
