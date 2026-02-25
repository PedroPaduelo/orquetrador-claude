import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useHooksStore } from '../store'
import { HookForm } from './hook-form'

export function HookModal() {
  const { isModalOpen, editingHook, closeModal } = useHooksStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingHook ? 'Editar Hook' : 'Novo Hook'}
          </DialogTitle>
        </DialogHeader>
        <HookForm />
      </DialogContent>
    </Dialog>
  )
}
