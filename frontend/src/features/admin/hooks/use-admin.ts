import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminApi } from '../api'

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
    staleTime: 30000,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Role atualizado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao atualizar role')
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Usuario excluido com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir usuario')
    },
  })
}
