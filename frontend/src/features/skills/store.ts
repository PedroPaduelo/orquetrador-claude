import { create } from 'zustand'
import { skillsApi } from './api'
import type { Skill } from './types'

interface SkillsState {
  isModalOpen: boolean
  editingSkill: Skill | null
  isLoadingEdit: boolean
  openCreateModal: () => void
  openEditModal: (skill: Skill) => Promise<void>
  closeModal: () => void
}

export const useSkillsStore = create<SkillsState>((set) => ({
  isModalOpen: false,
  editingSkill: null,
  isLoadingEdit: false,

  openCreateModal: () => set({ isModalOpen: true, editingSkill: null, isLoadingEdit: false }),

  openEditModal: async (skill) => {
    set({ isModalOpen: true, editingSkill: skill, isLoadingEdit: true })
    try {
      const full = await skillsApi.get(skill.id)
      set({ editingSkill: full, isLoadingEdit: false })
    } catch {
      set({ isLoadingEdit: false })
    }
  },

  closeModal: () => set({ isModalOpen: false, editingSkill: null, isLoadingEdit: false }),
}))
