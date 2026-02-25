import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { gitApi } from '../api'

export function useGitTokenStatus() {
  return useQuery({
    queryKey: ['git', 'token-status'],
    queryFn: () => gitApi.getTokenStatus(),
  })
}

export function useSaveGitToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => gitApi.saveToken(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git'] })
      toast.success('Token GitHub salvo com sucesso')
    },
    onError: () => {
      toast.error('Erro ao salvar token')
    },
  })
}

export function useRemoveGitToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => gitApi.removeToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git'] })
      toast.success('Token GitHub removido')
    },
    onError: () => {
      toast.error('Erro ao remover token')
    },
  })
}

export function useGitRepos() {
  return useQuery({
    queryKey: ['git', 'repos'],
    queryFn: () => gitApi.listRepos(1, 50),
    enabled: false, // only fetch when explicitly triggered
  })
}

export function useGitClone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ repoUrl, folderName, branch }: { repoUrl: string; folderName?: string; branch?: string }) =>
      gitApi.clone(repoUrl, folderName, branch),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success(data.message)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao clonar repositorio')
    },
  })
}

export function useGitStatus(projectPath: string | undefined) {
  return useQuery({
    queryKey: ['git', 'status', projectPath],
    queryFn: () => gitApi.getStatus(projectPath!),
    enabled: !!projectPath,
  })
}

export function useGitPull() {
  return useMutation({
    mutationFn: (projectPath: string) => gitApi.pull(projectPath),
    onSuccess: (data) => {
      toast.success(data.message)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao fazer pull')
    },
  })
}

export function useGitPush() {
  return useMutation({
    mutationFn: (projectPath: string) => gitApi.push(projectPath),
    onSuccess: (data) => {
      toast.success(data.message)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao fazer push')
    },
  })
}
