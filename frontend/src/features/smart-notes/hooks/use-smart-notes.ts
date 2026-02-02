import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSmartNotesStatus,
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  moveNote,
  archiveNote,
  unarchiveNote,
  pinNote,
  unpinNote,
  searchNotes,
  listTags,
  addTagToNote,
  removeTagFromNote,
  previewContext,
} from '../api'
import type {
  ListNotesParams,
  SearchNotesParams,
  CreateNoteParams,
  UpdateNoteParams,
  CreateFolderParams,
  UpdateFolderParams,
} from '../types'

// Keys
export const smartNotesKeys = {
  all: ['smart-notes'] as const,
  status: () => [...smartNotesKeys.all, 'status'] as const,
  folders: () => [...smartNotesKeys.all, 'folders'] as const,
  folder: (id: string) => [...smartNotesKeys.folders(), id] as const,
  notes: (params?: ListNotesParams) => [...smartNotesKeys.all, 'notes', params] as const,
  note: (id: string) => [...smartNotesKeys.all, 'note', id] as const,
  search: (params: SearchNotesParams) => [...smartNotesKeys.all, 'search', params] as const,
  tags: () => [...smartNotesKeys.all, 'tags'] as const,
  context: () => [...smartNotesKeys.all, 'context'] as const,
}

// Status
export function useSmartNotesStatus() {
  return useQuery({
    queryKey: smartNotesKeys.status(),
    queryFn: getSmartNotesStatus,
    staleTime: 30000,
  })
}

// Folders
export function useFolders() {
  return useQuery({
    queryKey: smartNotesKeys.folders(),
    queryFn: listFolders,
  })
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: smartNotesKeys.folder(id),
    queryFn: () => getFolder(id),
    enabled: !!id,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateFolderParams) => createFolder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...params }: UpdateFolderParams & { id: string }) =>
      updateFolder(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

// Notes
export function useNotes(params?: ListNotesParams) {
  return useQuery({
    queryKey: smartNotesKeys.notes(params),
    queryFn: () => listNotes(params),
  })
}

export function useNote(id: string) {
  return useQuery({
    queryKey: smartNotesKeys.note(id),
    queryFn: () => getNote(id),
    enabled: !!id,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateNoteParams) => createNote(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...params }: UpdateNoteParams & { id: string }) =>
      updateNote(id, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(variables.id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
    },
  })
}

export function useMoveNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      moveNote(id, folderId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(variables.id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.folders() })
    },
  })
}

export function useArchiveNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

export function useUnarchiveNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => unarchiveNote(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

export function usePinNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => pinNote(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

export function useUnpinNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => unpinNote(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(id) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
    },
  })
}

// Search
export function useSearchNotes(params: SearchNotesParams) {
  return useQuery({
    queryKey: smartNotesKeys.search(params),
    queryFn: () => searchNotes(params),
    enabled: params.query.length > 0,
  })
}

// Tags
export function useTags() {
  return useQuery({
    queryKey: smartNotesKeys.tags(),
    queryFn: listTags,
  })
}

export function useAddTagToNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, tagName }: { noteId: string; tagName: string }) =>
      addTagToNote(noteId, tagName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(variables.noteId) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.tags() })
    },
  })
}

export function useRemoveTagFromNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, tagName }: { noteId: string; tagName: string }) =>
      removeTagFromNote(noteId, tagName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.note(variables.noteId) })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.notes() })
      queryClient.invalidateQueries({ queryKey: smartNotesKeys.tags() })
    },
  })
}

// Context Preview
export function useContextPreview() {
  return useQuery({
    queryKey: smartNotesKeys.context(),
    queryFn: previewContext,
  })
}
