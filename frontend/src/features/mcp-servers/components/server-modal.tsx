import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useMcpServersStore } from '../store'
import { ServerForm } from './server-form'

export function ServerModal() {
  const { isModalOpen, editingServer, closeModal } = useMcpServersStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingServer ? 'Editar MCP Server' : 'Novo MCP Server'}
          </DialogTitle>
        </DialogHeader>
        <ServerForm />
      </DialogContent>
    </Dialog>
  )
}
