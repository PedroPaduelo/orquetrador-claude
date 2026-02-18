import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { useSkillsStore } from '../store'
import { useCreateSkill, useUpdateSkill } from '../hooks/use-skills'
import type { SkillInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  body: z.string().optional(),
  allowedToolsStr: z.string().optional(),
  model: z.string().optional(),
  isGlobal: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export function SkillForm() {
  const { editingSkill, isLoadingEdit, closeModal } = useSkillsStore()
  const createMutation = useCreateSkill()
  const updateMutation = useUpdateSkill()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingSkill?.name || '',
      description: editingSkill?.description || '',
      body: editingSkill?.body || '',
      allowedToolsStr: editingSkill?.allowedTools ? editingSkill.allowedTools.join(', ') : '',
      model: editingSkill?.model || '',
      isGlobal: editingSkill?.isGlobal ?? true,
    },
  })

  // Re-sync form when full skill data arrives
  useEffect(() => {
    if (editingSkill && !isLoadingEdit) {
      reset({
        name: editingSkill.name || '',
        description: editingSkill.description || '',
        body: editingSkill.body || '',
        allowedToolsStr: editingSkill.allowedTools ? editingSkill.allowedTools.join(', ') : '',
        model: editingSkill.model || '',
        isGlobal: editingSkill.isGlobal ?? true,
      })
    }
  }, [editingSkill, isLoadingEdit, reset])

  const onSubmit = (data: FormData) => {
    const allowedTools = data.allowedToolsStr
      ? data.allowedToolsStr.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const input: SkillInput = {
      name: data.name,
      description: data.description,
      body: data.body,
      allowedTools,
      model: data.model || undefined,
      isGlobal: data.isGlobal,
    }

    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, input })
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
          <span className="text-sm">Carregando dados da skill...</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} placeholder="minha-skill" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" {...register('description')} placeholder="Descricao opcional" rows={2} />
      </div>

      <div>
        <Label htmlFor="body">Corpo da Skill</Label>
        <Textarea id="body" {...register('body')} placeholder="Instrucoes da skill..." rows={8} className="font-mono text-sm" />
      </div>

      <div>
        <Label htmlFor="allowedToolsStr">Ferramentas Permitidas (separadas por virgula)</Label>
        <Input id="allowedToolsStr" {...register('allowedToolsStr')} placeholder="Read, Write, Bash" />
      </div>

      <div>
        <Label htmlFor="model">Modelo (opcional)</Label>
        <Input id="model" {...register('model')} placeholder="claude-sonnet-4-20250514" />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('isGlobal')} className="rounded" />
          <span className="text-sm">Global</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : editingSkill ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}
