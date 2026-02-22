import { useState, useMemo } from 'react'
import { Plus, Bot, Download, GitBranch, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { ImportRepoDialog } from '@/shared/components/common/import-repo-dialog'
import { useSearchPagination, SearchBar, FilterBar, Pagination, type FilterDefinition } from '@/shared/components/common/search-pagination'
import { AgentCard } from './components/agent-card'
import { AgentTable } from './components/agent-table'
import { AgentModal } from './components/agent-modal'
import { ImportAgentDialog } from './components/import-agent-dialog'
import { useAgents, useDeleteAgent, useToggleAgent, useResyncAgent } from './hooks/use-agents'
import { useAgentsStore } from './store'
import type { Agent } from './types'

const searchFields: (keyof Agent)[] = ['name', 'description', 'model']

const baseFilters: FilterDefinition<Agent>[] = [
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

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents()
  const deleteMutation = useDeleteAgent()
  const toggleMutation = useToggleAgent()
  const resyncMutation = useResyncAgent()
  const { openCreateModal, openEditModal } = useAgentsStore()

  const filters = useMemo(() => {
    const models = [...new Set((agents || []).map((a) => a.model).filter(Boolean))] as string[]
    if (models.length === 0) return baseFilters
    return [
      ...baseFilters,
      {
        key: 'model',
        label: 'Model',
        options: models.map((m) => ({ value: m, label: m })),
        match: (item: Agent, value: string) => item.model === value,
      },
    ]
  }, [agents])

  const { paged, search, setSearch, page, setPage, totalPages, total, activeFilters, setFilter, clearFilters, hasActiveFilters } = useSearchPagination({
    data: agents,
    searchFields,
    filters,
  })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('agents-view') as 'grid' | 'table') || 'grid'
  })
  const [importOpen, setImportOpen] = useState(false)
  const [repoOpen, setRepoOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; agent: Agent | null }>({
    open: false,
    agent: null,
  })

  const handleDelete = () => {
    if (deleteDialog.agent) {
      deleteMutation.mutate(deleteDialog.agent.id)
      setDeleteDialog({ open: false, agent: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie agentes com configuracoes personalizadas do Claude
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRepoOpen(true)}>
            <GitBranch className="h-4 w-4 mr-2" />
            Importar Repo
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Importar URL
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Criar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : agents && agents.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar agentes..." total={total} />
            </div>
            <div className="flex items-center border rounded-lg p-0.5">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('grid'); localStorage.setItem('agents-view', 'grid') }} title="Cards">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('table'); localStorage.setItem('agents-view', 'table') }} title="Tabela">
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <FilterBar filters={filters} activeFilters={activeFilters} onFilterChange={setFilter} onClear={clearFilters} hasActive={hasActiveFilters} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((agent, index) => (
                <div key={agent.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <AgentCard
                    agent={agent}
                    onEdit={() => openEditModal(agent)}
                    onDelete={() => setDeleteDialog({ open: true, agent })}
                    onToggle={() => toggleMutation.mutate(agent.id)}
                    onResync={() => resyncMutation.mutate(agent.id)}
                    isResyncing={resyncMutation.isPending}
                  />
                </div>
              ))}
            </div>
          ) : (
            <AgentTable
              agents={paged}
              onEdit={(agent) => openEditModal(agent)}
              onDelete={(agent) => setDeleteDialog({ open: true, agent })}
              onToggle={(agent) => toggleMutation.mutate(agent.id)}
              onResync={(agent) => resyncMutation.mutate(agent.id)}
              isResyncing={resyncMutation.isPending}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Bot}
          title="Nenhum Agente"
          description="Importe agentes de um repositorio GitHub ou crie manualmente."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setRepoOpen(true)}>
                <GitBranch className="h-4 w-4 mr-2" />
                Importar Repo
              </Button>
              <Button variant="outline" onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar
              </Button>
            </div>
          }
        />
      )}

      <AgentModal />
      <ImportAgentDialog open={importOpen} onOpenChange={setImportOpen} />
      <ImportRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, agent: null })}
        title="Excluir Agente"
        description={`Tem certeza que deseja excluir "${deleteDialog.agent?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
