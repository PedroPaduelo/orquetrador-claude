import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stepTemplatesApi } from '../api'
import type { StepTemplateInput } from '../types'

export function useStepTemplates() {
  return useQuery({
    queryKey: ['step-templates'],
    queryFn: stepTemplatesApi.list,
    staleTime: 30000,
  })
}

export function useStepTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['step-templates', id],
    queryFn: () => stepTemplatesApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateStepTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StepTemplateInput) => stepTemplatesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['step-templates'] })
      toast.success('Template criado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao criar template')
    },
  })
}

export function useUpdateStepTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<StepTemplateInput> }) =>
      stepTemplatesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['step-templates'] })
      toast.success('Template atualizado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao atualizar template')
    },
  })
}

export function useDeleteStepTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: stepTemplatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['step-templates'] })
      toast.success('Template excluido com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir template')
    },
  })
}
