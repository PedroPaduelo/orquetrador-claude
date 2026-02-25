import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiKeysApi } from '../api-keys-api'

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiKeysApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      toast.error('Erro ao criar API key')
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key revogada')
    },
    onError: () => {
      toast.error('Erro ao revogar API key')
    },
  })
}
