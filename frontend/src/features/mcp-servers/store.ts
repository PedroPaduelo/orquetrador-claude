import { create } from 'zustand'
import { mcpServersApi } from './api'
import type { McpServer } from './types'

interface McpServersState {
  isModalOpen: boolean
  editingServer: McpServer | null
  isLoadingEdit: boolean
  openCreateModal: () => void
  openEditModal: (server: McpServer) => Promise<void>
  closeModal: () => void
}

export const useMcpServersStore = create<McpServersState>((set) => ({
  isModalOpen: false,
  editingServer: null,
  isLoadingEdit: false,

  openCreateModal: () => set({ isModalOpen: true, editingServer: null, isLoadingEdit: false }),

  openEditModal: async (server) => {
    set({ isModalOpen: true, editingServer: server, isLoadingEdit: true })
    try {
      const full = await mcpServersApi.get(server.id)
      set({ editingServer: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingServer: null, isLoadingEdit: false }),
}))
