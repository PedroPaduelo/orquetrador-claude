import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { pluginsApi } from '../api'
import type { PluginInput } from '../types'

export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: pluginsApi.list,
    staleTime: 30000,
  })
}

export function useInstallPlugin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PluginInput) => pluginsApi.install(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Plugin instalado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao instalar plugin')
    },
  })
}

export function useDeletePlugin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: pluginsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Plugin removido!')
    },
    onError: () => {
      toast.error('Erro ao remover plugin')
    },
  })
}

export function useTogglePlugin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: pluginsApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
  })
}

export function useImportPluginUrl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: pluginsApi.importUrl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Plugin importado via URL!')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao importar plugin')
    },
  })
}
