import { useEffect, useMemo, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { WizardStepper } from './components/wizard-stepper'
import { WizardFooter } from './components/wizard-footer'
import { PhaseBasicInfo } from './components/phase-basic-info'
import { PhaseStepBuilder } from './components/phase-step-builder'
import { PhaseReview } from './components/phase-review'
import { useWorkflowsStore } from '../store'
import { useCreateWorkflow, useUpdateWorkflow } from '../hooks/use-workflows'
import type { WorkflowInput } from '../types'

export default function WorkflowWizardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id

  const {
    currentPhase,
    basicInfo,
    formSteps,
    editingWorkflow,
    isLoadingEdit,
    setPhase,
    initCreate,
    initEdit,
    resetWizard,
  } = useWorkflowsStore()

  const createMutation = useCreateWorkflow()
  const updateMutation = useUpdateWorkflow()

  const [phase1Errors, setPhase1Errors] = useState<Record<string, string>>({})

  // Initialize wizard on mount
  useEffect(() => {
    if (isEditing) {
      // Load workflow for editing -- initEdit fetches full data
      initEdit({ id } as any)
    } else {
      initCreate()
    }
    return () => {
      resetWizard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Dirty check for navigation protection
  const isDirty = useMemo(() => {
    if (isLoadingEdit) return false
    return basicInfo.name.trim() !== '' || formSteps.some((s) => s.baseUrl.trim() !== '')
  }, [basicInfo.name, formSteps, isLoadingEdit])

  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  // beforeunload protection
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Track completed phases
  const completedPhases = useMemo(() => {
    const completed: number[] = []
    if (basicInfo.name.trim()) completed.push(1)
    if (formSteps.some((s) => s.baseUrl.trim())) completed.push(2)
    return completed
  }, [basicInfo.name, formSteps])

  // Validation
  const validatePhase1 = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!basicInfo.name.trim()) {
      errors.name = 'Nome obrigatorio'
    }
    setPhase1Errors(errors)
    return Object.keys(errors).length === 0
  }, [basicInfo.name])

  const validatePhase2 = useCallback((): boolean => {
    if (formSteps.length === 0) {
      toast.error('Adicione pelo menos um step')
      return false
    }
    const hasBaseUrl = formSteps.every((s) => s.baseUrl.trim())
    if (!hasBaseUrl) {
      toast.error('Todos os steps precisam ter uma URL Base')
      return false
    }
    return true
  }, [formSteps])

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentPhase === 1) {
      if (!validatePhase1()) return
      setPhase(2)
    } else if (currentPhase === 2) {
      if (!validatePhase2()) return
      setPhase(3)
    }
  }, [currentPhase, validatePhase1, validatePhase2, setPhase])

  const handleBack = useCallback(() => {
    if (currentPhase === 2) setPhase(1)
    else if (currentPhase === 3) setPhase(2)
  }, [currentPhase, setPhase])

  const handlePhaseClick = useCallback(
    (phase: 1 | 2 | 3) => {
      // Can only go to completed phases or current
      if (phase < currentPhase || completedPhases.includes(phase)) {
        setPhase(phase)
      }
    },
    [currentPhase, completedPhases, setPhase]
  )

  const handleEditPhase = useCallback(
    (phase: 1 | 2) => {
      setPhase(phase)
    },
    [setPhase]
  )

  // Submit
  const handleSubmit = useCallback(() => {
    // Final validation
    if (!validatePhase1() || !validatePhase2()) {
      return
    }

    const input: WorkflowInput = {
      name: basicInfo.name,
      description: basicInfo.description || undefined,
      type: basicInfo.type,
      steps: formSteps.map((step) => ({
        name: step.name,
        baseUrl: step.baseUrl,
        systemPrompt: step.systemPrompt,
        systemPromptNoteId: step.systemPromptNoteId,
        contextNoteIds: step.contextNoteIds,
        memoryNoteIds: step.memoryNoteIds,
        conditions: step.conditions,
        maxRetries: step.maxRetries,
        mcpServerIds: step.mcpServerIds,
        skillIds: step.skillIds,
        agentIds: step.agentIds,
        ruleIds: step.ruleIds,
      })),
    }

    if (isEditing && editingWorkflow) {
      updateMutation.mutate(
        { id: editingWorkflow.id, input },
        { onSuccess: () => navigate('/workflows') }
      )
    } else {
      createMutation.mutate(input, {
        onSuccess: () => navigate('/workflows'),
      })
    }
  }, [
    basicInfo,
    formSteps,
    isEditing,
    editingWorkflow,
    createMutation,
    updateMutation,
    navigate,
    validatePhase1,
    validatePhase2,
  ])

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  // Loading state for edit mode
  if (isEditing && isLoadingEdit) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full max-w-2xl mx-auto" />
          <Skeleton className="h-64 w-full max-w-2xl mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b px-6 py-3 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (isDirty) {
              setShowLeaveDialog(true)
            } else {
              navigate('/workflows')
            }
          }}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-sm font-medium">
          {isEditing ? 'Editar Workflow' : 'Novo Workflow'}
        </h1>
      </div>

      {/* Stepper */}
      <WizardStepper
        currentPhase={currentPhase}
        onPhaseClick={handlePhaseClick}
        completedPhases={completedPhases}
      />

      {/* Phase content */}
      {currentPhase === 2 ? (
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 min-h-0">
          <PhaseStepBuilder />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
          {currentPhase === 1 && <PhaseBasicInfo errors={phase1Errors} />}
          {currentPhase === 3 && <PhaseReview onEditPhase={handleEditPhase} />}
        </div>
      )}

      {/* Footer */}
      <WizardFooter
        currentPhase={currentPhase}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isEditing={isEditing}
        isSubmitting={isSubmitting}
      />

      {/* Leave confirmation dialog */}
      <ConfirmDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        title="Sair sem salvar?"
        description="Voce tem alteracoes nao salvas. Deseja realmente sair?"
        confirmLabel="Sair"
        onConfirm={() => navigate('/workflows')}
        variant="destructive"
      />
    </div>
  )
}
