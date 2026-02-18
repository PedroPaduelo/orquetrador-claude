import { create } from 'zustand'
import { agentsApi } from './api'
import type { Agent } from './types'

interface AgentsState {
  isModalOpen: boolean
  editingAgent: Agent | null
  isLoadingEdit: boolean
  openCreateModal: () => void
  openEditModal: (agent: Agent) => Promise<void>
  closeModal: () => void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  isModalOpen: false,
  editingAgent: null,
  isLoadingEdit: false,

  openCreateModal: () => set({ isModalOpen: true, editingAgent: null, isLoadingEdit: false }),

  openEditModal: async (agent) => {
    set({ isModalOpen: true, editingAgent: agent, isLoadingEdit: true })
    try {
      const full = await agentsApi.get(agent.id)
      set({ editingAgent: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingAgent: null, isLoadingEdit: false }),
}))
