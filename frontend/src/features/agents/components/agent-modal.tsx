import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useAgentsStore } from '../store'
import { AgentForm } from './agent-form'

export function AgentModal() {
  const { isModalOpen, editingAgent, closeModal } = useAgentsStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingAgent ? 'Editar Agente' : 'Novo Agente'}
          </DialogTitle>
        </DialogHeader>
        <AgentForm />
      </DialogContent>
    </Dialog>
  )
}
