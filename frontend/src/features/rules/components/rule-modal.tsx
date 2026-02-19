import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useRulesStore } from '../store'
import { RuleForm } from './rule-form'

export function RuleModal() {
  const { isModalOpen, editingRule, closeModal } = useRulesStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Editar Rule' : 'Nova Rule'}
          </DialogTitle>
        </DialogHeader>
        <RuleForm />
      </DialogContent>
    </Dialog>
  )
}
