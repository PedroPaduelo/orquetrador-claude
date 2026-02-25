import { create } from 'zustand'
import { authApi, type AuthUser } from './api'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { token, user } = await authApi.login(email, password)
    localStorage.setItem('token', token)
    set({ token, user, isAuthenticated: true })
  },

  register: async (email, password, name) => {
    const { token, user } = await authApi.register(email, password, name)
    localStorage.setItem('token', token)
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      const user = await authApi.me()
      set({ user, token, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
