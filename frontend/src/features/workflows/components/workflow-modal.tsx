import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useWorkflowsStore } from '../store'
import { WorkflowForm } from './workflow-form'

export function WorkflowModal() {
  const { isModalOpen, editingWorkflow, closeModal } = useWorkflowsStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingWorkflow ? 'Editar Workflow' : 'Novo Workflow'}
          </DialogTitle>
        </DialogHeader>
        <WorkflowForm />
      </DialogContent>
    </Dialog>
  )
}
