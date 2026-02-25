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

  clone: async (repoUrl: string, folderName?: string, branch?: string) => {
    const { data } = await apiClient.post('/git/clone', { repoUrl, folderName, branch })
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

  init: async (projectPath: string, remoteUrl?: string) => {
    const { data } = await apiClient.post('/git/init', { projectPath, remoteUrl })
    return data as { success: boolean; message: string }
  },
}
