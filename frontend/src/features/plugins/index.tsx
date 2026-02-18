import { useState } from 'react'
import { Plus, Package, GitBranch } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { ImportRepoDialog } from '@/shared/components/common/import-repo-dialog'
import { PluginCard } from './components/plugin-card'
import { InstallDialog } from './components/install-dialog'
import { usePlugins, useDeletePlugin, useTogglePlugin } from './hooks/use-plugins'
import type { Plugin } from './types'

export default function PluginsPage() {
  const { data: plugins, isLoading } = usePlugins()
  const deleteMutation = useDeletePlugin()
  const toggleMutation = useTogglePlugin()

  const [installOpen, setInstallOpen] = useState(false)
  const [repoOpen, setRepoOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; plugin: Plugin | null }>({
    open: false,
    plugin: null,
  })

  const handleDelete = () => {
    if (deleteDialog.plugin) {
      deleteMutation.mutate(deleteDialog.plugin.id)
      setDeleteDialog({ open: false, plugin: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plugins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Instale e gerencie plugins para expandir as capacidades do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRepoOpen(true)}>
            <GitBranch className="h-4 w-4 mr-2" />
            Importar Repo
          </Button>
          <Button onClick={() => setInstallOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Instalar Manual
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : plugins && plugins.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin, index) => (
            <div key={plugin.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
              <PluginCard
                plugin={plugin}
                onDelete={() => setDeleteDialog({ open: true, plugin })}
                onToggle={() => toggleMutation.mutate(plugin.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Nenhum Plugin"
          description="Instale plugins para adicionar MCP servers, skills e agentes de uma vez."
          action={
            <Button onClick={() => setInstallOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Instalar Plugin
            </Button>
          }
        />
      )}

      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
      <ImportRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, plugin: null })}
        title="Remover Plugin"
        description={`Tem certeza que deseja remover "${deleteDialog.plugin?.name}"? Isso tambem removera todos os recursos associados.`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
