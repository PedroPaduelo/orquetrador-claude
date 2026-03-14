import { apiClient } from '@/shared/lib/api-client'

export interface GitTokenStatus {
  hasToken: boolean
  username: string | null
}

export interface GitRepo {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  cloneUrl: string
  defaultBranch: string
  language: string | null
  updatedAt: string
}

export interface GitAccount {
  id: string
  label: string
  username: string | null
  createdAt: string
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  modified: number
  untracked: number
  staged: number
  hasRemote: boolean
  remoteUrl: string | null
  lastCommit: string | null
}

export const gitApi = {
  saveToken: async (token: string) => {
    const { data } = await apiClient.put('/git/token', { token })
    return data as { success: boolean; message: string }
  },

  removeToken: async () => {
    const { data } = await apiClient.delete('/git/token')
    return data as { success: boolean; message: string }
  },

  getTokenStatus: async (): Promise<GitTokenStatus> => {
    const { data } = await apiClient.get('/git/token/status')
    return data
  },

  listRepos: async (page = 1, perPage = 30, sort = 'updated'): Promise<GitRepo[]> => {
    const { data } = await apiClient.get('/git/repos', { params: { page, perPage, sort } })
    return data
  },

  clone: async (repoUrl: string, folderName?: string, branch?: string, gitAccountId?: string) => {
    const { data } = await apiClient.post('/git/clone', { repoUrl, folderName, branch, gitAccountId })
    return data as { success: boolean; path: string; message: string }
  },

  getStatus: async (projectPath: string): Promise<GitStatus> => {
    const { data } = await apiClient.post('/git/status', { projectPath })
    return data
  },

  pull: async (projectPath: string) => {
    const { data } = await apiClient.post('/git/pull', { projectPath })
    return data as { success: boolean; message: string }
  },

  push: async (projectPath: string) => {
    const { data } = await apiClient.post('/git/push', { projectPath })
    return data as { success: boolean; message: string }
  },

  // Git Accounts (multi-account)
  listAccounts: async (): Promise<GitAccount[]> => {
    const { data } = await apiClient.get('/git/accounts')
    return data
  },

  createAccount: async (label: string, token: string): Promise<GitAccount> => {
    const { data } = await apiClient.post('/git/accounts', { label, token })
    return data
  },

  updateAccount: async (id: string, updates: { label?: string; token?: string }): Promise<GitAccount> => {
    const { data } = await apiClient.put(`/git/accounts/${id}`, updates)
    return data
  },

  deleteAccount: async (id: string) => {
    const { data } = await apiClient.delete(`/git/accounts/${id}`)
    return data as { success: boolean; message: string }
  },

  listAccountRepos: async (accountId: string, page = 1, perPage = 30, sort = 'updated'): Promise<GitRepo[]> => {
    const { data } = await apiClient.get(`/git/accounts/${accountId}/repos`, { params: { page, perPage, sort } })
    return data
  },

  getProjectAccount: async (projectPath: string): Promise<GitAccount | null> => {
    const { data } = await apiClient.get('/git/project-account', { params: { projectPath } })
    return data
  },

  init: async (projectPath: string, remoteUrl?: string) => {
    const { data } = await apiClient.post('/git/init', { projectPath, remoteUrl })
    return data as { success: boolean; message: string }
  },
}
