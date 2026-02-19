import { useState } from 'react'
import { Plus, ScrollText, Download, GitBranch } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { ImportRepoDialog } from '@/shared/components/common/import-repo-dialog'
import { useSearchPagination, SearchBar, Pagination } from '@/shared/components/common/search-pagination'
import { RuleCard } from './components/rule-card'
import { RuleModal } from './components/rule-modal'
import { ImportRuleDialog } from './components/import-rule-dialog'
import { useRules, useDeleteRule, useToggleRule } from './hooks/use-rules'
import { useRulesStore } from './store'
import type { Rule } from './types'

const searchFields: (keyof Rule)[] = ['name', 'description']

export default function RulesPage() {
  const { data: rules, isLoading } = useRules()
  const deleteMutation = useDeleteRule()
  const toggleMutation = useToggleRule()
  const { openCreateModal, openEditModal } = useRulesStore()

  const { paged, search, setSearch, page, setPage, totalPages, total } = useSearchPagination({
    data: rules,
    searchFields,
  })

  const [importOpen, setImportOpen] = useState(false)
  const [repoOpen, setRepoOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; rule: Rule | null }>({
    open: false,
    rule: null,
  })

  const handleDelete = () => {
    if (deleteDialog.rule) {
      deleteMutation.mutate(deleteDialog.rule.id)
      setDeleteDialog({ open: false, rule: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie rules para definir diretrizes e restricoes do Claude
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
      ) : rules && rules.length > 0 ? (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar rules..." total={total} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paged.map((rule, index) => (
              <div key={rule.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <RuleCard
                  rule={rule}
                  onEdit={() => openEditModal(rule)}
                  onDelete={() => setDeleteDialog({ open: true, rule })}
                  onToggle={() => toggleMutation.mutate(rule.id)}
                />
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={ScrollText}
          title="Nenhuma Rule"
          description="Importe rules de um repositorio GitHub ou crie manualmente."
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

      <RuleModal />
      <ImportRuleDialog open={importOpen} onOpenChange={setImportOpen} />
      <ImportRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, rule: null })}
        title="Excluir Rule"
        description={`Tem certeza que deseja excluir "${deleteDialog.rule?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
