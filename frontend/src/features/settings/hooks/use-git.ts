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
    mutationFn: ({ repoUrl, folderName, branch, gitAccountId }: { repoUrl: string; folderName?: string; branch?: string; gitAccountId?: string }) =>
      gitApi.clone(repoUrl, folderName, branch, gitAccountId),
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

export function useGitAccounts() {
  return useQuery({
    queryKey: ['git', 'accounts'],
    queryFn: () => gitApi.listAccounts(),
  })
}

export function useCreateGitAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ label, token }: { label: string; token: string }) => gitApi.createAccount(label, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git'] })
      toast.success('Conta GitHub adicionada com sucesso')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar conta')
    },
  })
}

export function useUpdateGitAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; label?: string; token?: string }) => gitApi.updateAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git'] })
      toast.success('Conta GitHub atualizada')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar conta')
    },
  })
}

export function useDeleteGitAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gitApi.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git'] })
      toast.success('Conta GitHub removida')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover conta')
    },
  })
}

export function useGitAccountRepos(accountId: string | null) {
  return useQuery({
    queryKey: ['git', 'account-repos', accountId],
    queryFn: () => gitApi.listAccountRepos(accountId!, 1, 50),
    enabled: false, // only fetch when explicitly triggered
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
