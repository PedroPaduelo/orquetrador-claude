import { useState } from 'react'
import { Plus, Workflow } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { WorkflowCard } from './components/workflow-card'
import { WorkflowModal } from './components/workflow-modal'
import { useWorkflows, useDeleteWorkflow } from './hooks/use-workflows'
import { useWorkflowsStore } from './store'
import type { Workflow as WorkflowType } from './types'

export default function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows()
  const deleteMutation = useDeleteWorkflow()
  const { openCreateModal, openEditModal } = useWorkflowsStore()

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
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Workflow
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <ListSkeleton count={4} />
      ) : workflows && workflows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow, index) => (
            <div
              key={workflow.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <WorkflowCard
                workflow={workflow}
                onEdit={() => openEditModal(workflow)}
                onDelete={() => setDeleteDialog({ open: true, workflow })}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Workflow}
          title="Nenhum workflow encontrado"
          description="Crie seu primeiro workflow para começar a automatizar tarefas com Claude."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Workflow
            </Button>
          }
        />
      )}

      {/* Modal */}
      <WorkflowModal />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, workflow: null })}
        title="Excluir Workflow"
        description={`Tem certeza que deseja excluir "${deleteDialog.workflow?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
