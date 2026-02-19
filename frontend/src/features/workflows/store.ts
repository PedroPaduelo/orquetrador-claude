import { create } from 'zustand'
import { workflowsApi } from './api'
import type { Workflow, WorkflowStep } from './types'

interface WorkflowsState {
  // Modal state
  isModalOpen: boolean
  editingWorkflow: Workflow | null
  isLoadingEdit: boolean

  // Form state
  formSteps: WorkflowStep[]

  // Actions
  openCreateModal: () => void
  openEditModal: (workflow: Workflow) => Promise<void>
  closeModal: () => void
  setFormSteps: (steps: WorkflowStep[]) => void
  addStep: () => void
  removeStep: (index: number) => void
  updateStep: (index: number, data: Partial<WorkflowStep>) => void
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

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  isModalOpen: false,
  editingWorkflow: null,
  isLoadingEdit: false,
  formSteps: [{ ...defaultStep }],

  openCreateModal: () =>
    set({
      isModalOpen: true,
      editingWorkflow: null,
      isLoadingEdit: false,
      formSteps: [{ ...defaultStep }],
    }),

  openEditModal: async (workflow) => {
    // Open modal immediately with loading state
    set({
      isModalOpen: true,
      editingWorkflow: workflow,
      isLoadingEdit: true,
      formSteps: [],
    })

    try {
      // Fetch full workflow with steps
      const full = await workflowsApi.get(workflow.id)
      const steps = full.steps?.map((s) => ({
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
      })
    } catch {
      // Fallback: use whatever data we have
      set({
        isLoadingEdit: false,
        formSteps: workflow.steps?.map((s) => ({ ...s })) || [{ ...defaultStep }],
      })
    }
  },

  closeModal: () =>
    set({
      isModalOpen: false,
      editingWorkflow: null,
      isLoadingEdit: false,
      formSteps: [{ ...defaultStep }],
    }),

  setFormSteps: (steps) => set({ formSteps: steps }),

  addStep: () =>
    set((state) => ({
      formSteps: [...state.formSteps, { ...defaultStep }],
    })),

  removeStep: (index) =>
    set((state) => ({
      formSteps: state.formSteps.filter((_, i) => i !== index),
    })),

  updateStep: (index, data) =>
    set((state) => ({
      formSteps: state.formSteps.map((step, i) =>
        i === index ? { ...step, ...data } : step
      ),
    })),
}))
