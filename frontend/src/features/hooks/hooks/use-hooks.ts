import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { hooksApi } from '../api'
import { useHooksStore } from '../store'
import type { HookInput } from '../types'

export function useHooks() {
  return useQuery({
    queryKey: ['hooks'],
    queryFn: hooksApi.list,
    staleTime: 30000,
  })
}

export function useHook(id: string | undefined) {
  return useQuery({
    queryKey: ['hooks', id],
    queryFn: () => hooksApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateHook() {
  const queryClient = useQueryClient()
  const { closeModal } = useHooksStore()
  return useMutation({
    mutationFn: (input: HookInput) => hooksApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hooks'] })
      toast.success('Hook criado com sucesso!')
      closeModal()
    },
    onError: () => { toast.error('Erro ao criar hook') },
  })
}

export function useUpdateHook() {
  const queryClient = useQueryClient()
  const { closeModal } = useHooksStore()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HookInput> }) =>
      hooksApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hooks'] })
      toast.success('Hook atualizado!')
      closeModal()
    },
    onError: () => { toast.error('Erro ao atualizar hook') },
  })
}

export function useDeleteHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: hooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hooks'] })
      toast.success('Hook excluido!')
    },
    onError: () => { toast.error('Erro ao excluir hook') },
  })
}

export function useToggleHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: hooksApi.toggle,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hooks'] }) },
  })
}

export function useHookTemplates() {
  return useQuery({
    queryKey: ['hooks', 'templates'],
    queryFn: hooksApi.getTemplates,
    staleTime: Infinity,
  })
}

export function useHookEvents() {
  return useQuery({
    queryKey: ['hooks', 'events'],
    queryFn: hooksApi.getEvents,
    staleTime: Infinity,
  })
}

export function useCreateFromTemplate() {
  const queryClient = useQueryClient()
  const { closeTemplates } = useHooksStore()
  return useMutation({
    mutationFn: (templateId: string) => hooksApi.createFromTemplate(templateId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hooks'] })
      toast.success(`Hook "${data.name}" criado a partir do template!`)
      closeTemplates()
    },
    onError: () => { toast.error('Erro ao criar hook do template') },
  })
}

export function useHookPreview(hookIds?: string[]) {
  return useQuery({
    queryKey: ['hooks', 'preview', hookIds],
    queryFn: () => hooksApi.preview(hookIds),
    enabled: false,
  })
}
