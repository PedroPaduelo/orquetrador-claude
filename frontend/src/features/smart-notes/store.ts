import { create } from 'zustand'

interface SmartNotesState {
  selectedNoteId: string | null
  searchQuery: string
  expandedFolderIds: Set<string>

  setSelectedNoteId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  toggleFolder: (id: string) => void
  expandFolder: (id: string) => void
  collapseFolder: (id: string) => void
  reset: () => void
}

export const useSmartNotesStore = create<SmartNotesState>((set) => ({
  selectedNoteId: null,
  searchQuery: '',
  expandedFolderIds: new Set<string>(),

  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleFolder: (id) =>
    set((state) => {
      const next = new Set(state.expandedFolderIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedFolderIds: next }
    }),

  expandFolder: (id) =>
    set((state) => {
      const next = new Set(state.expandedFolderIds)
      next.add(id)
      return { expandedFolderIds: next }
    }),

  collapseFolder: (id) =>
    set((state) => {
      const next = new Set(state.expandedFolderIds)
      next.delete(id)
      return { expandedFolderIds: next }
    }),

  reset: () =>
    set({
      selectedNoteId: null,
      searchQuery: '',
      expandedFolderIds: new Set<string>(),
    }),
}))
