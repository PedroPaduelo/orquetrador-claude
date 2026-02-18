import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { SkillCard } from './components/skill-card'
import { SkillModal } from './components/skill-modal'
import { useSkills, useDeleteSkill, useToggleSkill } from './hooks/use-skills'
import { useSkillsStore } from './store'
import type { Skill } from './types'

export default function SkillsPage() {
  const { data: skills, isLoading } = useSkills()
  const deleteMutation = useDeleteSkill()
  const toggleMutation = useToggleSkill()
  const { openCreateModal, openEditModal } = useSkillsStore()

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; skill: Skill | null }>({
    open: false,
    skill: null,
  })

  const handleDelete = () => {
    if (deleteDialog.skill) {
      deleteMutation.mutate(deleteDialog.skill.id)
      setDeleteDialog({ open: false, skill: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie skills para definir comportamentos reutilizaveis do Claude
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Skill
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : skills && skills.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill, index) => (
            <div key={skill.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
              <SkillCard
                skill={skill}
                onEdit={() => openEditModal(skill)}
                onDelete={() => setDeleteDialog({ open: true, skill })}
                onToggle={() => toggleMutation.mutate(skill.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma Skill"
          description="Crie skills para definir comportamentos reutilizaveis para o Claude."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Skill
            </Button>
          }
        />
      )}

      <SkillModal />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, skill: null })}
        title="Excluir Skill"
        description={`Tem certeza que deseja excluir "${deleteDialog.skill?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
