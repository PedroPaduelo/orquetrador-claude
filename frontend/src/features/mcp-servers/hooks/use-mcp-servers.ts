import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mcpServersApi } from '../api'
import { useMcpServersStore } from '../store'
import type { McpServerInput } from '../types'

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: mcpServersApi.list,
    staleTime: 30000,
  })
}

export function useMcpServer(id: string | undefined) {
  return useQuery({
    queryKey: ['mcp-servers', id],
    queryFn: () => mcpServersApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateMcpServer() {
  const queryClient = useQueryClient()
  const { closeModal } = useMcpServersStore()

  return useMutation({
    mutationFn: (input: McpServerInput) => mcpServersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success('MCP Server criado com sucesso!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao criar MCP Server')
    },
  })
}

export function useUpdateMcpServer() {
  const queryClient = useQueryClient()
  const { closeModal } = useMcpServersStore()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<McpServerInput> }) =>
      mcpServersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success('MCP Server atualizado!')
      closeModal()
    },
    onError: () => {
      toast.error('Erro ao atualizar MCP Server')
    },
  })
}

export function useDeleteMcpServer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: mcpServersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success('MCP Server excluido!')
    },
    onError: () => {
      toast.error('Erro ao excluir MCP Server')
    },
  })
}

export function useToggleMcpServer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: mcpServersApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    },
  })
}

export function useTestMcpServer() {
  return useMutation({
    mutationFn: mcpServersApi.test,
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Conexao OK!')
      } else {
        toast.error(`Falha: ${result.error || 'Erro desconhecido'}`)
      }
    },
    onError: () => {
      toast.error('Erro ao testar conexao')
    },
  })
}
