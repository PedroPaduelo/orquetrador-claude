import { create } from 'zustand'
import type { McpServer } from './types'

interface McpServersState {
  isModalOpen: boolean
  editingServer: McpServer | null
  openCreateModal: () => void
  openEditModal: (server: McpServer) => void
  closeModal: () => void
}

export const useMcpServersStore = create<McpServersState>((set) => ({
  isModalOpen: false,
  editingServer: null,

  openCreateModal: () => set({ isModalOpen: true, editingServer: null }),
  openEditModal: (server) => set({ isModalOpen: true, editingServer: server }),
  closeModal: () => set({ isModalOpen: false, editingServer: null }),
}))
