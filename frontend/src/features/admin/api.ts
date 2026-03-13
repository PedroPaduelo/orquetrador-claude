import { apiClient } from '@/shared/lib/api-client'

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

export const adminApi = {
  async listUsers(): Promise<AdminUser[]> {
    const { data } = await apiClient.get('/admin/users')
    return data
  },

  async updateUserRole(userId: string, role: string): Promise<AdminUser> {
    const { data } = await apiClient.put(`/admin/users/${userId}/role`, { role })
    return data
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`)
  },
}
