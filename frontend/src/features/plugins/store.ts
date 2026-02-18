import { create } from 'zustand'
import { pluginsApi } from './api'
import type { Plugin } from './types'

interface PluginsState {
  isModalOpen: boolean
  editingPlugin: Plugin | null
  isLoadingEdit: boolean
  openEditModal: (plugin: Plugin) => Promise<void>
  closeModal: () => void
}

export const usePluginsStore = create<PluginsState>((set) => ({
  isModalOpen: false,
  editingPlugin: null,
  isLoadingEdit: false,

  openEditModal: async (plugin) => {
    set({ isModalOpen: true, editingPlugin: plugin, isLoadingEdit: true })
    try {
      const full = await pluginsApi.get(plugin.id)
      set({ editingPlugin: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingPlugin: null, isLoadingEdit: false }),
}))
