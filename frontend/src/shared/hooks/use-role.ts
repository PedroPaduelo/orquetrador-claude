import { useAuthStore } from '@/features/auth/store'

export function useRole() {
  const { user } = useAuthStore()
  const role = user?.role || 'developer'
  return {
    role,
    isAdmin: role === 'admin',
    canEdit: role === 'admin' || role === 'developer',
    canExecute: role === 'admin' || role === 'developer',
    isViewer: role === 'viewer',
  }
}
