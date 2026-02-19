import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rulesApi } from '../api'
import { useRulesStore } from '../store'
import type { RuleInput } from '../types'

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.list,
    staleTime: 30000,
  })
}

export function useRule(id: string | undefined) {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: () => rulesApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateRule() {
  const queryClient = useQueryClient()
  const { closeModal } = useRulesStore()
  return useMutation({
    mutationFn: (input: RuleInput) => rulesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Rule criada com sucesso!')
      closeModal()
    },
    onError: () => { toast.error('Erro ao criar rule') },
  })
}

export function useUpdateRule() {
  const queryClient = useQueryClient()
  const { closeModal } = useRulesStore()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<RuleInput> }) =>
      rulesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Rule atualizada!')
      closeModal()
    },
    onError: () => { toast.error('Erro ao atualizar rule') },
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Rule excluida!')
    },
    onError: () => { toast.error('Erro ao excluir rule') },
  })
}

export function useToggleRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rulesApi.toggle,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rules'] }) },
  })
}

export function useImportRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rulesApi.import,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      toast.success(`Rule "${data.name}" importada!`)
    },
    onError: (err: Error) => { toast.error(err.message || 'Erro ao importar rule') },
  })
}
