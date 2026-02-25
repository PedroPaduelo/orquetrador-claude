import { useState } from 'react'
import { Plus, Webhook, Sparkles, FileJson, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { useSearchPagination, SearchBar, FilterBar, Pagination, type FilterDefinition } from '@/shared/components/common/search-pagination'
import { HookCard } from './components/hook-card'
import { HookModal } from './components/hook-modal'
import { HookTemplatesDialog } from './components/hook-templates'
import { HookPreviewDialog } from './components/hook-preview'
import { useHooks, useDeleteHook, useToggleHook } from './hooks/use-hooks'
import { useHooksStore } from './store'
import type { Hook } from './types'

const searchFields: (keyof Hook)[] = ['name', 'description', 'eventType']

const filters: FilterDefinition<Hook>[] = [
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
    key: 'event',
    label: 'Evento',
    options: [
      { value: 'PreToolUse', label: 'Pre Tool Use' },
      { value: 'PostToolUse', label: 'Post Tool Use' },
      { value: 'Stop', label: 'Stop' },
      { value: 'UserPromptSubmit', label: 'User Prompt' },
      { value: 'SessionStart', label: 'Session Start' },
    ],
    match: (item, value) => item.eventType === value,
  },
  {
    key: 'handler',
    label: 'Handler',
    options: [
      { value: 'command', label: 'Comando' },
      { value: 'prompt', label: 'Prompt' },
      { value: 'agent', label: 'Agente' },
    ],
    match: (item, value) => item.handlerType === value,
  },
]

export default function HooksPage() {
  const { data: hooks, isLoading } = useHooks()
  const deleteMutation = useDeleteHook()
  const toggleMutation = useToggleHook()
  const { openCreateModal, openEditModal, openTemplates, openPreview } = useHooksStore()

  const { paged, search, setSearch, page, setPage, totalPages, total, activeFilters, setFilter, clearFilters, hasActiveFilters } = useSearchPagination({
    data: hooks,
    searchFields,
    filters,
  })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('hooks-view') as 'grid' | 'table') || 'grid'
  })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; hook: Hook | null }>({
    open: false,
    hook: null,
  })

  const handleDelete = () => {
    if (deleteDialog.hook) {
      deleteMutation.mutate(deleteDialog.hook.id)
      setDeleteDialog({ open: false, hook: null })
    }
  }

  const activeCount = hooks?.filter(h => h.enabled).length ?? 0

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatize acoes no ciclo de vida do Claude Code
            {hooks && hooks.length > 0 && (
              <span className="ml-2 text-primary font-medium">{activeCount} ativo{activeCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openPreview} disabled={!hooks?.length}>
            <FileJson className="h-4 w-4 mr-2" />
            Preview JSON
          </Button>
          <Button variant="outline" onClick={openTemplates}>
            <Sparkles className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Criar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : hooks && hooks.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar hooks..." total={total} />
            </div>
            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('grid'); localStorage.setItem('hooks-view', 'grid') }}
                title="Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('table'); localStorage.setItem('hooks-view', 'table') }}
                title="Lista"
              >
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <FilterBar filters={filters} activeFilters={activeFilters} onFilterChange={setFilter} onClear={clearFilters} hasActive={hasActiveFilters} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((hook, index) => (
                <div key={hook.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <HookCard
                    hook={hook}
                    onEdit={() => openEditModal(hook)}
                    onDelete={() => setDeleteDialog({ open: true, hook })}
                    onToggle={() => toggleMutation.mutate(hook.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {paged.map((hook, index) => (
                <div key={hook.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <HookCard
                    hook={hook}
                    onEdit={() => openEditModal(hook)}
                    onDelete={() => setDeleteDialog({ open: true, hook })}
                    onToggle={() => toggleMutation.mutate(hook.id)}
                  />
                </div>
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Webhook}
          title="Nenhum Hook"
          description="Hooks permitem automatizar acoes no ciclo de vida do Claude. Comece usando um template ou crie do zero."
          action={
            <div className="flex gap-2">
              <Button onClick={openTemplates}>
                <Sparkles className="h-4 w-4 mr-2" />
                Usar Template
              </Button>
              <Button variant="outline" onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar
              </Button>
            </div>
          }
        />
      )}

      <HookModal />
      <HookTemplatesDialog />
      <HookPreviewDialog />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, hook: null })}
        title="Excluir Hook"
        description={`Tem certeza que deseja excluir "${deleteDialog.hook?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
