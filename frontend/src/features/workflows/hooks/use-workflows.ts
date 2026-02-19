import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workflowsApi } from '../api'
import { useWorkflowsStore } from '../store'
import type { WorkflowInput } from '../types'

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: workflowsApi.list,
    staleTime: 30000,
  })
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => workflowsApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  const { closeModal } = useWorkflowsStore()

  return useMutation({
    mutationFn: (input: WorkflowInput) => workflowsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Workflow criado com sucesso!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao criar workflow')
    },
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  const { closeModal } = useWorkflowsStore()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<WorkflowInput> }) =>
      workflowsApi.update(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', id] })
      toast.success('Workflow atualizado com sucesso!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao atualizar workflow')
    },
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Workflow excluido com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir workflow')
    },
  })
}

export function useDuplicateWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: workflowsApi.duplicate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Workflow duplicado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao duplicar workflow')
    },
  })
}
