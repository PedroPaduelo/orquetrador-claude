import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { usePluginsStore } from '../store'
import { PluginForm } from './plugin-form'

export function PluginModal() {
  const { isModalOpen, editingPlugin, closeModal } = usePluginsStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Plugin</DialogTitle>
          <DialogDescription>
            {editingPlugin?.name || 'Plugin'}
          </DialogDescription>
        </DialogHeader>
        <PluginForm />
      </DialogContent>
    </Dialog>
  )
}
