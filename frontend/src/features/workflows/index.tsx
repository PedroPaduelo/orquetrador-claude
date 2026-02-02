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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">Gerencie seus workflows de automacao</p>
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
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onEdit={() => openEditModal(workflow)}
              onDelete={() => setDeleteDialog({ open: true, workflow })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Workflow}
          title="Nenhum workflow encontrado"
          description="Crie seu primeiro workflow para comecar a automatizar tarefas com Claude."
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
        description={`Tem certeza que deseja excluir "${deleteDialog.workflow?.name}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
