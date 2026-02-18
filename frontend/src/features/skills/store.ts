import { create } from 'zustand'
import type { Skill } from './types'

interface SkillsState {
  isModalOpen: boolean
  editingSkill: Skill | null
  openCreateModal: () => void
  openEditModal: (skill: Skill) => void
  closeModal: () => void
}

export const useSkillsStore = create<SkillsState>((set) => ({
  isModalOpen: false,
  editingSkill: null,

  openCreateModal: () => set({ isModalOpen: true, editingSkill: null }),
  openEditModal: (skill) => set({ isModalOpen: true, editingSkill: skill }),
  closeModal: () => set({ isModalOpen: false, editingSkill: null }),
}))
