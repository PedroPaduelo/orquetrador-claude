import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import {
  useSearchPagination,
  SearchBar,
  FilterBar,
  Pagination,
  type FilterDefinition,
} from '@/shared/components/common/search-pagination'
import { WorkflowCard } from './components/workflow-card'
import { WorkflowTable } from './components/workflow-table'
import { useWorkflows, useDeleteWorkflow, useDuplicateWorkflow } from './hooks/use-workflows'
import type { Workflow as WorkflowType } from './types'

const searchFields: (keyof WorkflowType)[] = ['name', 'description']

const filters: FilterDefinition<WorkflowType>[] = [
  {
    key: 'type',
    label: 'Tipo',
    options: [
      { value: 'sequential', label: 'Sequencial' },
      { value: 'step_by_step', label: 'Passo a Passo' },
    ],
    match: (item, value) => item.type === value,
  },
]

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const { data: workflows, isLoading } = useWorkflows()
  const deleteMutation = useDeleteWorkflow()
  const duplicateMutation = useDuplicateWorkflow()

  const {
    paged,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total,
    activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useSearchPagination({ data: workflows, searchFields, filters })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('workflows-view') as 'grid' | 'table') || 'grid'
  })

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; workflow: WorkflowType | null }>({
    open: false,
    workflow: null,
  })

  const handleDelete = () => {
    if (deleteDialog.workflow) {
      deleteMutation.mutate(deleteDialog.workflow.id)
      setDeleteDialog({ open: false, workflow: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina os passos que o Claude vai seguir nos seus projetos
          </p>
        </div>
        <Button onClick={() => navigate('/workflows/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Workflow
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <ListSkeleton count={4} />
      ) : workflows && workflows.length > 0 ? (
        <>
          {/* Search + View Toggle */}
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar workflows..."
              total={total}
            />
            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('grid'); localStorage.setItem('workflows-view', 'grid') }}
                title="Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('table'); localStorage.setItem('workflows-view', 'table') }}
                title="Tabela"
              >
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActive={hasActiveFilters}
          />

          {/* Grid / Table */}
          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((workflow, index) => (
                <div
                  key={workflow.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <WorkflowCard
                    workflow={workflow}
                    onEdit={() => navigate(`/workflows/${workflow.id}/edit`)}
                    onDelete={() => setDeleteDialog({ open: true, workflow })}
                    onDuplicate={() => duplicateMutation.mutate(workflow.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <WorkflowTable
              workflows={paged}
              onEdit={(w) => navigate(`/workflows/${w.id}/edit`)}
              onDelete={(w) => setDeleteDialog({ open: true, workflow: w })}
              onDuplicate={(w) => duplicateMutation.mutate(w.id)}
            />
          )}

          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Workflow}
          title="Nenhum workflow encontrado"
          description="Crie seu primeiro workflow para comecar a automatizar tarefas com Claude."
          action={
            <Button onClick={() => navigate('/workflows/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Workflow
            </Button>
          }
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, workflow: null })}
        title="Excluir Workflow"
        description={`Tem certeza que deseja excluir "${deleteDialog.workflow?.name}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
