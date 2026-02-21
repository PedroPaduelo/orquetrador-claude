import { create } from 'zustand'
import type { Action, WorkflowStepSummary } from './types'

interface ConversationsState {
  // Streaming state
  isStreaming: boolean
  streamingContent: string
  streamingActions: Action[]
  currentStepIndex: number
  totalSteps: number

  // Step statuses
  stepStatuses: Map<string, 'pending' | 'running' | 'active' | 'completed' | 'error' | 'retry' | 'cancelled'>

  // Actions cache (persisted per message)
  actionsCache: Map<string, Action[]>

  // Actions
  setStreaming: (value: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (content: string) => void
  addStreamingAction: (action: Action) => void
  clearStreaming: () => void
  resetStreamingContent: () => void

  setProgress: (stepIndex: number, totalSteps: number) => void
  setStepStatus: (stepId: string, status: 'pending' | 'running' | 'active' | 'completed' | 'error' | 'retry' | 'cancelled') => void
  initStepStatuses: (steps: WorkflowStepSummary[]) => void

  cacheActions: (messageId: string, actions: Action[]) => void
  getCachedActions: (messageId: string) => Action[] | undefined
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  isStreaming: false,
  streamingContent: '',
  streamingActions: [],
  currentStepIndex: 0,
  totalSteps: 0,
  stepStatuses: new Map(),
  actionsCache: new Map(),

  setStreaming: (value) => set({ isStreaming: value }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),

  addStreamingAction: (action) =>
    set((state) => ({ streamingActions: [...state.streamingActions, action] })),

  clearStreaming: () =>
    set({
      isStreaming: false,
      streamingContent: '',
      streamingActions: [],
    }),

  resetStreamingContent: () =>
    set({
      streamingContent: '',
      streamingActions: [],
    }),

  setProgress: (stepIndex, totalSteps) =>
    set({ currentStepIndex: stepIndex, totalSteps }),

  setStepStatus: (stepId, status) =>
    set((state) => {
      const newStatuses = new Map(state.stepStatuses)
      newStatuses.set(stepId, status)
      return { stepStatuses: newStatuses }
    }),

  initStepStatuses: (steps) =>
    set(() => {
      const statuses = new Map<string, 'pending' | 'running' | 'active' | 'completed' | 'error' | 'retry' | 'cancelled'>()
      steps.forEach((step) => statuses.set(step.id, 'pending'))
      return { stepStatuses: statuses }
    }),

  cacheActions: (messageId, actions) =>
    set((state) => {
      const newCache = new Map(state.actionsCache)
      newCache.set(messageId, actions)
      return { actionsCache: newCache }
    }),

  getCachedActions: (messageId) => get().actionsCache.get(messageId),
}))
