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
import { useRulesStore } from '../store'
import { useCreateRule, useUpdateRule } from '../hooks/use-rules'
import { useSkills } from '@/features/skills/hooks/use-skills'
import type { RuleInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  body: z.string().optional(),
  isGlobal: z.boolean(),
  skillId: z.string().nullable().optional(),
})

type FormData = z.infer<typeof formSchema>

export function RuleForm() {
  const { editingRule, isLoadingEdit, closeModal } = useRulesStore()
  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()
  const { data: skills } = useSkills()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingRule?.name || '',
      description: editingRule?.description || '',
      body: editingRule?.body || '',
      isGlobal: editingRule?.isGlobal ?? true,
      skillId: editingRule?.skillId || null,
    },
  })

  useEffect(() => {
    if (editingRule && !isLoadingEdit) {
      reset({
        name: editingRule.name || '',
        description: editingRule.description || '',
        body: editingRule.body || '',
        isGlobal: editingRule.isGlobal ?? true,
        skillId: editingRule.skillId || null,
      })
    }
  }, [editingRule, isLoadingEdit, reset])

  const selectedSkillId = watch('skillId')

  const onSubmit = (data: FormData) => {
    const input: RuleInput = {
      name: data.name,
      description: data.description,
      body: data.body,
      isGlobal: data.isGlobal,
      skillId: data.skillId || null,
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, input })
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
          <span className="text-sm">Carregando dados da rule...</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} placeholder="minha-rule" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" {...register('description')} placeholder="Descricao opcional" rows={2} />
      </div>

      <div>
        <Label htmlFor="body">Corpo da Rule</Label>
        <Textarea id="body" {...register('body')} placeholder="Conteudo da rule em markdown..." rows={8} className="font-mono text-sm" />
      </div>

      <div>
        <Label>Skill (opcional)</Label>
        <Select
          value={selectedSkillId || '_none'}
          onValueChange={(value) => setValue('skillId', value === '_none' ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Nenhuma skill" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nenhuma (rule global)</SelectItem>
            {skills?.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Associar a uma skill salva a rule em .claude/skills/{'{nome}'}/rules/
        </p>
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
          {isLoading ? 'Salvando...' : editingRule ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}
