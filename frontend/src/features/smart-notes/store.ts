import { create } from 'zustand'

interface SmartNotesState {
  // UI State
  selectedFolderId: string | null
  selectedNoteId: string | null
  searchQuery: string
  isSearching: boolean
  viewMode: 'list' | 'grid'

  // Actions
  setSelectedFolderId: (id: string | null) => void
  setSelectedNoteId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setIsSearching: (searching: boolean) => void
  setViewMode: (mode: 'list' | 'grid') => void
  reset: () => void
}

const initialState = {
  selectedFolderId: null,
  selectedNoteId: null,
  searchQuery: '',
  isSearching: false,
  viewMode: 'list' as const,
}

export const useSmartNotesStore = create<SmartNotesState>((set) => ({
  ...initialState,

  setSelectedFolderId: (id) => set({ selectedFolderId: id, selectedNoteId: null }),
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setViewMode: (mode) => set({ viewMode: mode }),
  reset: () => set(initialState),
}))
