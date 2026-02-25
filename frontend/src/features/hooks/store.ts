import { create } from 'zustand'
import { hooksApi } from './api'
import type { Hook } from './types'

interface HooksState {
  isModalOpen: boolean
  editingHook: Hook | null
  isLoadingEdit: boolean
  isTemplatesOpen: boolean
  isPreviewOpen: boolean
  openCreateModal: () => void
  openEditModal: (hook: Hook) => Promise<void>
  closeModal: () => void
  openTemplates: () => void
  closeTemplates: () => void
  openPreview: () => void
  closePreview: () => void
}

export const useHooksStore = create<HooksState>((set) => ({
  isModalOpen: false,
  editingHook: null,
  isLoadingEdit: false,
  isTemplatesOpen: false,
  isPreviewOpen: false,

  openCreateModal: () => set({ isModalOpen: true, editingHook: null, isLoadingEdit: false }),

  openEditModal: async (hook) => {
    set({ isModalOpen: true, editingHook: hook, isLoadingEdit: true })
    try {
      const full = await hooksApi.get(hook.id)
      set({ editingHook: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingHook: null, isLoadingEdit: false }),
  openTemplates: () => set({ isTemplatesOpen: true }),
  closeTemplates: () => set({ isTemplatesOpen: false }),
  openPreview: () => set({ isPreviewOpen: true }),
  closePreview: () => set({ isPreviewOpen: false }),
}))
