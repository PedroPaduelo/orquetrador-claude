import { useState } from 'react'
import { Shield, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { useAuthStore } from '@/features/auth/store'
import { useAdminUsers, useUpdateUserRole, useDeleteUser } from './hooks/use-admin'
import type { AdminUser } from './api'

const roleBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  developer: 'secondary',
  viewer: 'outline',
}

export default function AdminPage() {
  const { user: currentUser } = useAuthStore()
  const { data: users, isLoading } = useAdminUsers()
  const updateRoleMutation = useUpdateUserRole()
  const deleteMutation = useDeleteUser()

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  })

  const handleRoleChange = (userId: string, role: string) => {
    updateRoleMutation.mutate({ userId, role })
  }

  const handleDelete = () => {
    if (deleteDialog.user) {
      deleteMutation.mutate(deleteDialog.user.id)
      setDeleteDialog({ open: false, user: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Administracao
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerenciar usuarios e permissoes
          </p>
        </div>
      </div>

      <Card>
        <div className="h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Usuarios ({users?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum usuario encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">
                      Email
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">
                      Nome
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">
                      Role
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">
                      Criado em
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-2">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <span className="text-sm">{u.email}</span>
                          {isSelf && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                              voce
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm text-muted-foreground">
                            {u.name || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {isSelf ? (
                            <Badge variant={roleBadgeVariants[u.role] || 'outline'}>
                              {u.role}
                            </Badge>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(value) => handleRoleChange(u.id, value)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">admin</SelectItem>
                                <SelectItem value="developer">developer</SelectItem>
                                <SelectItem value="viewer">viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteDialog({ open: true, user: u })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, user: null })}
        title="Excluir Usuario"
        description={`Tem certeza que deseja excluir "${deleteDialog.user?.email}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
