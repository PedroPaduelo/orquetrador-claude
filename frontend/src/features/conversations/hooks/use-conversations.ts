import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { conversationsApi } from '../api'
import type { CreateConversationInput } from '../types'

export function useConversations(workflowId?: string) {
  return useQuery({
    queryKey: ['conversations', workflowId],
    queryFn: () => conversationsApi.list(workflowId),
  })
}

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => conversationsApi.listFolders(),
  })
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversations', id, 'detail'],
    queryFn: () => conversationsApi.get(id!),
    enabled: !!id,
    refetchInterval: false,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (input: CreateConversationInput) => conversationsApi.create(input),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Conversa criada!')
      navigate(`/conversations/${conversation.id}`)
    },
    onError: () => {
      toast.error('Erro ao criar conversa')
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: conversationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversa excluida!')
    },
    onError: () => {
      toast.error('Erro ao excluir conversa')
    },
  })
}

export function useDeleteManyConversations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => conversationsApi.deleteMany(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success(`${data.deleted} conversa${data.deleted > 1 ? 's' : ''} excluida${data.deleted > 1 ? 's' : ''}!`)
    },
    onError: () => {
      toast.error('Erro ao excluir conversas')
    },
  })
}

export function useCloneConversation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (id: string) => conversationsApi.clone(id),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Conversa clonada!')
      navigate(`/conversations/${conversation.id}`)
    },
    onError: () => {
      toast.error('Erro ao clonar conversa')
    },
  })
}

export function useCancelExecution(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => conversationsApi.cancel(conversationId),
    onSuccess: () => {
      toast.info('Execucao cancelada')
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      queryClient.invalidateQueries({ queryKey: ['executions-summary'] })
    },
    onError: () => {
      toast.error('Erro ao cancelar execucao')
    },
  })
}

export function useAdvanceStep(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => conversationsApi.advanceStep(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      toast.success('Avançou para o próximo step!')
    },
    onError: () => {
      toast.error('Erro ao avançar step')
    },
  })
}

export function useGoBackStep(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => conversationsApi.goBackStep(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      toast.success('Voltou para o step anterior!')
    },
    onError: () => {
      toast.error('Erro ao voltar step')
    },
  })
}

export function useJumpToStep(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stepId: string) => conversationsApi.jumpToStep(conversationId, stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
    },
    onError: () => {
      toast.error('Erro ao pular para o step')
    },
  })
}

export function useUpdateConversationTitle(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (title: string) => conversationsApi.updateTitle(conversationId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: () => {
      toast.error('Erro ao atualizar titulo')
    },
  })
}

export function useResetStepSession(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stepId: string) => conversationsApi.resetStepSession(conversationId, stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      toast.success('Sessão do step resetada!')
    },
    onError: () => {
      toast.error('Erro ao resetar sessão do step')
    },
  })
}

export function useTokenUsage(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['token-usage', conversationId],
    queryFn: () => conversationsApi.getTokenUsage(conversationId!),
    enabled: !!conversationId,
    refetchInterval: false,
  })
}

export function useExecutionStats(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['execution-stats', conversationId],
    queryFn: () => conversationsApi.getExecutionStats(conversationId!),
    enabled: !!conversationId,
    refetchInterval: false,
  })
}
