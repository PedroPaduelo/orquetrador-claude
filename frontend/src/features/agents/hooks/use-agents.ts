import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { agentsApi } from '../api'
import { useAgentsStore } from '../store'
import type { AgentInput } from '../types'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    staleTime: 30000,
  })
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()
  const { closeModal } = useAgentsStore()

  return useMutation({
    mutationFn: (input: AgentInput) => agentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agente criado com sucesso!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao criar agente')
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  const { closeModal } = useAgentsStore()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AgentInput> }) =>
      agentsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agente atualizado!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao atualizar agente')
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: agentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agente excluido!')
    },
    onError: () => {
      toast.error('Erro ao excluir agente')
    },
  })
}

export function useToggleAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: agentsApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
