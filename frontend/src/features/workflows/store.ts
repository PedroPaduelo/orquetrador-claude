import { create } from 'zustand'
import type { Workflow, WorkflowStep } from './types'

interface WorkflowsState {
  // Modal state
  isModalOpen: boolean
  editingWorkflow: Workflow | null

  // Form state
  formSteps: WorkflowStep[]

  // Actions
  openCreateModal: () => void
  openEditModal: (workflow: Workflow) => void
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
}

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  isModalOpen: false,
  editingWorkflow: null,
  formSteps: [{ ...defaultStep }],

  openCreateModal: () =>
    set({
      isModalOpen: true,
      editingWorkflow: null,
      formSteps: [{ ...defaultStep }],
    }),

  openEditModal: (workflow) =>
    set({
      isModalOpen: true,
      editingWorkflow: workflow,
      formSteps: workflow.steps?.map((s) => ({ ...s })) || [{ ...defaultStep }],
    }),

  closeModal: () =>
    set({
      isModalOpen: false,
      editingWorkflow: null,
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
