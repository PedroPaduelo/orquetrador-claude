import { useState } from 'react'
import { Plus, Package, GitBranch, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { ImportRepoDialog } from '@/shared/components/common/import-repo-dialog'
import { useSearchPagination, SearchBar, FilterBar, Pagination, type FilterDefinition } from '@/shared/components/common/search-pagination'
import { PluginCard } from './components/plugin-card'
import { PluginTable } from './components/plugin-table'
import { PluginModal } from './components/plugin-modal'
import { InstallDialog } from './components/install-dialog'
import { usePlugins, useDeletePlugin, useTogglePlugin, useResyncPlugin } from './hooks/use-plugins'
import { usePluginsStore } from './store'
import type { Plugin } from './types'

const searchFields: (keyof Plugin)[] = ['name', 'description', 'author']

const filters: FilterDefinition<Plugin>[] = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'enabled', label: 'Ativo' },
      { value: 'disabled', label: 'Inativo' },
    ],
    match: (item, value) => value === 'enabled' ? item.enabled : !item.enabled,
  },
  {
    key: 'source',
    label: 'Origem',
    options: [
      { value: 'manual', label: 'Manual' },
      { value: 'imported', label: 'Importado' },
    ],
    match: (item, value) => item.source === value,
  },
]

export default function PluginsPage() {
  const { data: plugins, isLoading } = usePlugins()
  const deleteMutation = useDeletePlugin()
  const toggleMutation = useTogglePlugin()
  const resyncMutation = useResyncPlugin()
  const { openEditModal } = usePluginsStore()

  const { paged, search, setSearch, page, setPage, totalPages, total, activeFilters, setFilter, clearFilters, hasActiveFilters } = useSearchPagination({
    data: plugins,
    searchFields,
    filters,
  })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('plugins-view') as 'grid' | 'table') || 'grid'
  })
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
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar plugins..." total={total} />
            </div>
            <div className="flex items-center border rounded-lg p-0.5">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('grid'); localStorage.setItem('plugins-view', 'grid') }} title="Cards">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('table'); localStorage.setItem('plugins-view', 'table') }} title="Tabela">
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <FilterBar filters={filters} activeFilters={activeFilters} onFilterChange={setFilter} onClear={clearFilters} hasActive={hasActiveFilters} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((plugin, index) => (
                <div key={plugin.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <PluginCard
                    plugin={plugin}
                    onEdit={() => openEditModal(plugin)}
                    onDelete={() => setDeleteDialog({ open: true, plugin })}
                    onToggle={() => toggleMutation.mutate(plugin.id)}
                    onResync={() => resyncMutation.mutate({ id: plugin.id })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <PluginTable
              plugins={paged}
              onEdit={(plugin) => openEditModal(plugin)}
              onDelete={(plugin) => setDeleteDialog({ open: true, plugin })}
              onToggle={(plugin) => toggleMutation.mutate(plugin.id)}
              onResync={(plugin) => resyncMutation.mutate({ id: plugin.id })}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Package}
          title="Nenhum Plugin"
          description="Instale plugins para adicionar MCP servers, skills e agentes de uma vez."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setRepoOpen(true)}>
                <GitBranch className="h-4 w-4 mr-2" />
                Importar Repo
              </Button>
              <Button variant="outline" onClick={() => setInstallOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Instalar Manual
              </Button>
            </div>
          }
        />
      )}

      <PluginModal />
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
