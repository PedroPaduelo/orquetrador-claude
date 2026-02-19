import { create } from 'zustand'
import { rulesApi } from './api'
import type { Rule } from './types'

interface RulesState {
  isModalOpen: boolean
  editingRule: Rule | null
  isLoadingEdit: boolean
  openCreateModal: () => void
  openEditModal: (rule: Rule) => Promise<void>
  closeModal: () => void
}

export const useRulesStore = create<RulesState>((set) => ({
  isModalOpen: false,
  editingRule: null,
  isLoadingEdit: false,

  openCreateModal: () => set({ isModalOpen: true, editingRule: null, isLoadingEdit: false }),

  openEditModal: async (rule) => {
    set({ isModalOpen: true, editingRule: rule, isLoadingEdit: true })
    try {
      const full = await rulesApi.get(rule.id)
      set({ editingRule: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingRule: null, isLoadingEdit: false }),
}))
