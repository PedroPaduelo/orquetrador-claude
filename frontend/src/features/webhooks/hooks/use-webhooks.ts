import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { webhooksApi } from '../api'
import type { WebhookInput } from '../api'

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.list,
    staleTime: 30000,
  })
}

export function useWebhook(id: string | undefined) {
  return useQuery({
    queryKey: ['webhooks', id],
    queryFn: () => webhooksApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WebhookInput) => webhooksApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook criado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao criar webhook')
    },
  })
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<WebhookInput> }) =>
      webhooksApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook atualizado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao atualizar webhook')
    },
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook excluido com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir webhook')
    },
  })
}

export function useToggleWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: webhooksApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })
}

export function useWebhookDeliveries(webhookId: string | undefined) {
  return useQuery({
    queryKey: ['webhooks', webhookId, 'deliveries'],
    queryFn: () => webhooksApi.listDeliveries(webhookId!),
    enabled: !!webhookId,
    staleTime: 15000,
  })
}
