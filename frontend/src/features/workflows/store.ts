import { create } from 'zustand'
import { workflowsApi } from './api'
import type { Workflow, WorkflowStep } from './types'

interface BasicInfo {
  name: string
  description: string
  type: 'sequential' | 'step_by_step'
}

interface WorkflowsState {
  // Wizard state
  currentPhase: 1 | 2 | 3
  basicInfo: BasicInfo
  selectedStepIndex: number
  isLoadingEdit: boolean
  editingWorkflow: Workflow | null

  // Legacy modal state (kept for backwards compat during migration)
  isModalOpen: boolean

  // Form state
  formSteps: WorkflowStep[]

  // Wizard actions
  setPhase: (phase: 1 | 2 | 3) => void
  setBasicInfo: (partial: Partial<BasicInfo>) => void
  setSelectedStepIndex: (index: number) => void
  moveStep: (from: number, to: number) => void
  duplicateStep: (index: number) => void
  initCreate: () => void
  initEdit: (workflow: Workflow) => Promise<void>
  resetWizard: () => void

  // Form actions
  setFormSteps: (steps: WorkflowStep[]) => void
  addStep: () => void
  removeStep: (index: number) => void
  updateStep: (index: number, data: Partial<WorkflowStep>) => void

  // Legacy
  openCreateModal: () => void
  openEditModal: (workflow: Workflow) => Promise<void>
  closeModal: () => void
}

const defaultStep: WorkflowStep = {
  name: '',
  baseUrl: '',
  contextNoteIds: [],
  memoryNoteIds: [],
  conditions: { rules: [], default: 'next' },
  maxRetries: 0,
  mcpServerIds: [],
  skillIds: [],
  agentIds: [],
  ruleIds: [],
}

const defaultBasicInfo: BasicInfo = {
  name: '',
  description: '',
  type: 'sequential',
}

export const useWorkflowsStore = create<WorkflowsState>((set, get) => ({
  // Wizard state
  currentPhase: 1,
  basicInfo: { ...defaultBasicInfo },
  selectedStepIndex: 0,
  isLoadingEdit: false,
  editingWorkflow: null,

  // Legacy
  isModalOpen: false,

  // Form state
  formSteps: [{ ...defaultStep }],

  // Wizard actions
  setPhase: (phase) => set({ currentPhase: phase }),

  setBasicInfo: (partial) =>
    set((state) => ({
      basicInfo: { ...state.basicInfo, ...partial },
    })),

  setSelectedStepIndex: (index) => set({ selectedStepIndex: index }),

  moveStep: (from, to) =>
    set((state) => {
      if (to < 0 || to >= state.formSteps.length) return state
      const steps = [...state.formSteps]
      const [moved] = steps.splice(from, 1)
      steps.splice(to, 0, moved)
      return { formSteps: steps, selectedStepIndex: to }
    }),

  duplicateStep: (index) =>
    set((state) => {
      const original = state.formSteps[index]
      if (!original) return state
      const copy: WorkflowStep = {
        ...original,
        id: undefined,
        name: original.name ? `${original.name} (copia)` : '',
        mcpServerIds: [...original.mcpServerIds],
        skillIds: [...original.skillIds],
        agentIds: [...original.agentIds],
        ruleIds: [...original.ruleIds],
        contextNoteIds: [...original.contextNoteIds],
        memoryNoteIds: [...original.memoryNoteIds],
        conditions: { ...original.conditions, rules: [...original.conditions.rules] },
      }
      const steps = [...state.formSteps]
      steps.splice(index + 1, 0, copy)
      return { formSteps: steps, selectedStepIndex: index + 1 }
    }),

  initCreate: () =>
    set({
      currentPhase: 1,
      basicInfo: { ...defaultBasicInfo },
      formSteps: [{ ...defaultStep }],
      selectedStepIndex: 0,
      editingWorkflow: null,
      isLoadingEdit: false,
      isModalOpen: false,
    }),

  initEdit: async (workflow) => {
    set({
      currentPhase: 1,
      basicInfo: {
        name: workflow.name || '',
        description: workflow.description || '',
        type: workflow.type || 'sequential',
      },
      editingWorkflow: workflow,
      isLoadingEdit: true,
      selectedStepIndex: 0,
      formSteps: [],
      isModalOpen: false,
    })

    try {
      const full = await workflowsApi.get(workflow.id)
      const steps =
        full.steps?.map((s) => ({
          ...s,
          mcpServerIds: s.mcpServerIds || [],
          skillIds: s.skillIds || [],
          agentIds: s.agentIds || [],
          ruleIds: s.ruleIds || [],
          contextNoteIds: s.contextNoteIds || [],
          memoryNoteIds: s.memoryNoteIds || [],
          conditions: s.conditions || { rules: [], default: 'next' },
          maxRetries: s.maxRetries ?? 0,
        })) || [{ ...defaultStep }]

      set({
        editingWorkflow: full,
        isLoadingEdit: false,
        formSteps: steps,
        basicInfo: {
          name: full.name || '',
          description: full.description || '',
          type: full.type || 'sequential',
        },
      })
    } catch {
      set({
        isLoadingEdit: false,
        formSteps: workflow.steps?.map((s) => ({ ...s })) || [{ ...defaultStep }],
      })
    }
  },

  resetWizard: () =>
    set({
      currentPhase: 1,
      basicInfo: { ...defaultBasicInfo },
      formSteps: [{ ...defaultStep }],
      selectedStepIndex: 0,
      editingWorkflow: null,
      isLoadingEdit: false,
      isModalOpen: false,
    }),

  // Form actions
  setFormSteps: (steps) => set({ formSteps: steps }),

  addStep: () =>
    set((state) => {
      const newSteps = [...state.formSteps, { ...defaultStep }]
      return { formSteps: newSteps, selectedStepIndex: newSteps.length - 1 }
    }),

  removeStep: (index) =>
    set((state) => {
      const newSteps = state.formSteps.filter((_, i) => i !== index)
      const newIndex = Math.min(state.selectedStepIndex, newSteps.length - 1)
      return { formSteps: newSteps, selectedStepIndex: Math.max(0, newIndex) }
    }),

  updateStep: (index, data) =>
    set((state) => ({
      formSteps: state.formSteps.map((step, i) =>
        i === index ? { ...step, ...data } : step
      ),
    })),

  // Legacy modal actions
  openCreateModal: () => {
    get().initCreate()
    set({ isModalOpen: true })
  },

  openEditModal: async (workflow) => {
    set({ isModalOpen: true })
    await get().initEdit(workflow)
  },

  closeModal: () => {
    get().resetWizard()
  },
}))

export { defaultStep }
