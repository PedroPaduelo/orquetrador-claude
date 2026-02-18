import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { useSkillsStore } from '../store'
import { SkillForm } from './skill-form'

export function SkillModal() {
  const { isModalOpen, editingSkill, closeModal } = useSkillsStore()

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSkill ? 'Editar Skill' : 'Nova Skill'}
          </DialogTitle>
        </DialogHeader>
        <SkillForm />
      </DialogContent>
    </Dialog>
  )
}
