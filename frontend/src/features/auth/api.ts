import { apiClient } from '@/shared/lib/api-client'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  basePath: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export const authApi = {
  register: async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/register', { email, password, name })
    return data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/login', { email, password })
    return data
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get('/auth/me')
    return data
  },
}
