import { useState } from 'react'
import { Plus, Sparkles, Download, GitBranch, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { ImportRepoDialog } from '@/shared/components/common/import-repo-dialog'
import { useSearchPagination, SearchBar, FilterBar, Pagination, type FilterDefinition } from '@/shared/components/common/search-pagination'
import { SkillCard } from './components/skill-card'
import { SkillTable } from './components/skill-table'
import { SkillModal } from './components/skill-modal'
import { ImportSkillDialog } from './components/import-skill-dialog'
import { useSkills, useDeleteSkill, useToggleSkill, useResyncSkill } from './hooks/use-skills'
import { useSkillsStore } from './store'
import type { Skill } from './types'

const searchFields: (keyof Skill)[] = ['name', 'description']

const filters: FilterDefinition<Skill>[] = [
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

export default function SkillsPage() {
  const { data: skills, isLoading } = useSkills()
  const deleteMutation = useDeleteSkill()
  const toggleMutation = useToggleSkill()
  const resyncMutation = useResyncSkill()
  const { openCreateModal, openEditModal } = useSkillsStore()

  const { paged, search, setSearch, page, setPage, totalPages, total, activeFilters, setFilter, clearFilters, hasActiveFilters } = useSearchPagination({
    data: skills,
    searchFields,
    filters,
  })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('skills-view') as 'grid' | 'table') || 'grid'
  })
  const [importOpen, setImportOpen] = useState(false)
  const [repoOpen, setRepoOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; skill: Skill | null }>({
    open: false,
    skill: null,
  })

  const handleDelete = () => {
    if (deleteDialog.skill) {
      deleteMutation.mutate(deleteDialog.skill.id)
      setDeleteDialog({ open: false, skill: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie skills para definir comportamentos reutilizaveis do Claude
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
      ) : skills && skills.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar skills..." total={total} />
            </div>
            <div className="flex items-center border rounded-lg p-0.5">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('grid'); localStorage.setItem('skills-view', 'grid') }} title="Cards">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setViewMode('table'); localStorage.setItem('skills-view', 'table') }} title="Tabela">
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <FilterBar filters={filters} activeFilters={activeFilters} onFilterChange={setFilter} onClear={clearFilters} hasActive={hasActiveFilters} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((skill, index) => (
                <div key={skill.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <SkillCard
                    skill={skill}
                    onEdit={() => openEditModal(skill)}
                    onDelete={() => setDeleteDialog({ open: true, skill })}
                    onToggle={() => toggleMutation.mutate(skill.id)}
                    onResync={() => resyncMutation.mutate(skill.id)}
                    isResyncing={resyncMutation.isPending}
                  />
                </div>
              ))}
            </div>
          ) : (
            <SkillTable
              skills={paged}
              onEdit={(skill) => openEditModal(skill)}
              onDelete={(skill) => setDeleteDialog({ open: true, skill })}
              onToggle={(skill) => toggleMutation.mutate(skill.id)}
              onResync={(skill) => resyncMutation.mutate(skill.id)}
              isResyncing={resyncMutation.isPending}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma Skill"
          description="Importe skills de um repositorio GitHub ou crie manualmente."
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

      <SkillModal />
      <ImportSkillDialog open={importOpen} onOpenChange={setImportOpen} />
      <ImportRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, skill: null })}
        title="Excluir Skill"
        description={`Tem certeza que deseja excluir "${deleteDialog.skill?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
