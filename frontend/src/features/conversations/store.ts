import { create } from 'zustand'
import type { Action, WorkflowStepSummary } from './types'

export type StreamingPhase = 'idle' | 'preparing' | 'connecting' | 'ai_thinking' | 'streaming'

export interface PausedInfo {
  executionId: string
  stepId: string
  stepName: string
  stepOrder: number
  resumeToken: string | null
  askUserQuestion?: {
    question: string
    options?: Array<{ label: string; description?: string }>
  }
}

interface ConversationsState {
  // Streaming state
  isStreaming: boolean
  streamingPhase: StreamingPhase
  streamingContent: string
  streamingActions: Action[]
  currentStepIndex: number
  totalSteps: number

  // Paused state (waiting for user input)
  isPaused: boolean
  pausedInfo: PausedInfo | null

  // Step statuses
  stepStatuses: Map<string, 'pending' | 'running' | 'active' | 'completed' | 'error' | 'retry' | 'cancelled' | 'paused'>

  // Actions cache (persisted per message)
  actionsCache: Map<string, Action[]>

  // Actions
  setStreaming: (value: boolean) => void
  setStreamingPhase: (phase: StreamingPhase) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (content: string) => void
  addStreamingAction: (action: Action) => void
  clearStreaming: () => void
  resetStreamingContent: () => void

  // User interrupt state
  isInterrupting: boolean
  setInterrupting: (value: boolean) => void

  setPaused: (paused: boolean, info?: PausedInfo | null) => void

  setProgress: (stepIndex: number, totalSteps: number) => void
  setStepStatus: (stepId: string, status: 'pending' | 'running' | 'active' | 'completed' | 'error' | 'retry' | 'cancelled' | 'paused') => void
  initStepStatuses: (steps: WorkflowStepSummary[]) => void

  cacheActions: (messageId: string, actions: Action[]) => void
  getCachedActions: (messageId: string) => Action[] | undefined
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  isStreaming: false,
  streamingPhase: 'idle',
  streamingContent: '',
  streamingActions: [],
  currentStepIndex: 0,
  totalSteps: 0,
  isPaused: false,
  pausedInfo: null,
  isInterrupting: false,
  stepStatuses: new Map(),
  actionsCache: new Map(),

  setStreaming: (value) => set({ isStreaming: value, streamingPhase: value ? 'preparing' : 'idle' }),

  setStreamingPhase: (phase) => set({ streamingPhase: phase }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),

  addStreamingAction: (action) =>
    set((state) => ({ streamingActions: [...state.streamingActions, action] })),

  clearStreaming: () =>
    set({
      isStreaming: false,
      streamingPhase: 'idle',
      streamingContent: '',
      streamingActions: [],
    }),

  resetStreamingContent: () =>
    set({
      streamingPhase: 'ai_thinking',
      streamingContent: '',
      streamingActions: [],
    }),

  setInterrupting: (value) => set({ isInterrupting: value }),

  setPaused: (paused, info) =>
    set({
      isPaused: paused,
      pausedInfo: info ?? null,
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
