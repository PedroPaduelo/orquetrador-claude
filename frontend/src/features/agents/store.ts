import { create } from 'zustand'
import type { Agent } from './types'

interface AgentsState {
  isModalOpen: boolean
  editingAgent: Agent | null
  openCreateModal: () => void
  openEditModal: (agent: Agent) => void
  closeModal: () => void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  isModalOpen: false,
  editingAgent: null,

  openCreateModal: () => set({ isModalOpen: true, editingAgent: null }),
  openEditModal: (agent) => set({ isModalOpen: true, editingAgent: agent }),
  closeModal: () => set({ isModalOpen: false, editingAgent: null }),
}))
