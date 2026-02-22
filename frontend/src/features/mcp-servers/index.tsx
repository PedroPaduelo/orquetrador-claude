import { useState } from 'react'
import { Plus, Server, Download, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { useSearchPagination, SearchBar, FilterBar, Pagination, type FilterDefinition } from '@/shared/components/common/search-pagination'
import { ServerCard } from './components/server-card'
import { ServerTable } from './components/server-table'
import { ServerModal } from './components/server-modal'
import { QuickInstallDialog } from './components/quick-install-dialog'
import { useMcpServers, useDeleteMcpServer, useToggleMcpServer, useTestMcpServer } from './hooks/use-mcp-servers'
import { useMcpServersStore } from './store'
import type { McpServer } from './types'

type ViewMode = 'grid' | 'table'

const searchFields: (keyof McpServer)[] = ['name', 'description', 'type']

const filters: FilterDefinition<McpServer>[] = [
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
    key: 'type',
    label: 'Tipo',
    options: [
      { value: 'stdio', label: 'Stdio' },
      { value: 'sse', label: 'SSE' },
      { value: 'http', label: 'HTTP' },
    ],
    match: (item, value) => item.type === value,
  },
  {
    key: 'scope',
    label: 'Escopo',
    options: [
      { value: 'global', label: 'Global' },
      { value: 'local', label: 'Local' },
    ],
    match: (item, value) => value === 'global' ? item.isGlobal : !item.isGlobal,
  },
]

export default function McpServersPage() {
  const { data: servers, isLoading } = useMcpServers()
  const deleteMutation = useDeleteMcpServer()
  const toggleMutation = useToggleMcpServer()
  const testMutation = useTestMcpServer()
  const { openCreateModal, openEditModal } = useMcpServersStore()

  const { paged, search, setSearch, page, setPage, totalPages, total, activeFilters, setFilter, clearFilters, hasActiveFilters } = useSearchPagination({
    data: servers,
    searchFields,
    filters,
  })

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('mcp-servers-view') as ViewMode) || 'grid'
  })
  const [installOpen, setInstallOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; server: McpServer | null }>({
    open: false,
    server: null,
  })

  const handleDelete = () => {
    if (deleteDialog.server) {
      deleteMutation.mutate(deleteDialog.server.id)
      setDeleteDialog({ open: false, server: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie servidores MCP para expandir as ferramentas do Claude
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInstallOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Instalar
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Manual
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : servers && servers.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar servidores..." total={total} />
            </div>
            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('grid'); localStorage.setItem('mcp-servers-view', 'grid') }}
                title="Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('table'); localStorage.setItem('mcp-servers-view', 'table') }}
                title="Tabela"
              >
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <FilterBar filters={filters} activeFilters={activeFilters} onFilterChange={setFilter} onClear={clearFilters} hasActive={hasActiveFilters} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((server, index) => (
                <div key={server.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <ServerCard
                    server={server}
                    onEdit={() => openEditModal(server)}
                    onDelete={() => setDeleteDialog({ open: true, server })}
                    onTest={() => testMutation.mutate(server.id)}
                    onToggle={() => toggleMutation.mutate(server.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <ServerTable
              servers={paged}
              onEdit={(server) => openEditModal(server)}
              onDelete={(server) => setDeleteDialog({ open: true, server })}
              onTest={(server) => testMutation.mutate(server.id)}
              onToggle={(server) => toggleMutation.mutate(server.id)}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Server}
          title="Nenhum MCP Server"
          description="Instale servidores MCP da comunidade ou crie manualmente."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setInstallOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Instalar
              </Button>
              <Button variant="outline" onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Manual
              </Button>
            </div>
          }
        />
      )}

      <ServerModal />
      <QuickInstallDialog open={installOpen} onOpenChange={setInstallOpen} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, server: null })}
        title="Excluir MCP Server"
        description={`Tem certeza que deseja excluir "${deleteDialog.server?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
