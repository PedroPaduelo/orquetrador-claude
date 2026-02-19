import { apiClient } from '@/shared/lib/api-client'
import type {
  SmartNotesStatus,
  Folder,
  Note,
  NotePreview,
  Tag,
  ContextPreview,
  ListNotesParams,
  SearchNotesParams,
  CreateNoteParams,
  UpdateNoteParams,
  CreateFolderParams,
  UpdateFolderParams,
} from './types'

// Status
export async function getSmartNotesStatus(): Promise<SmartNotesStatus> {
  const { data } = await apiClient.get('/smart-notes/status')
  return data
}

// Folders
export async function listFolders(): Promise<Folder[]> {
  const { data } = await apiClient.get('/smart-notes/folders')
  return data.folders ?? data
}

export async function getFolder(id: string): Promise<Folder> {
  const { data } = await apiClient.get(`/smart-notes/folders/${id}`)
  return data
}

export async function createFolder(params: CreateFolderParams): Promise<Folder> {
  const { data } = await apiClient.post('/smart-notes/folders', params)
  return data
}

export async function updateFolder(id: string, params: UpdateFolderParams): Promise<Folder> {
  const { data } = await apiClient.put(`/smart-notes/folders/${id}`, params)
  return data
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/smart-notes/folders/${id}`)
}

// Notes
export async function listNotes(params?: ListNotesParams): Promise<NotePreview[]> {
  const { data } = await apiClient.get('/smart-notes/notes', { params })
  return data.notes ?? data
}

export async function getNote(id: string): Promise<Note> {
  const { data } = await apiClient.get(`/smart-notes/notes/${id}`)
  return data
}

export async function createNote(params: CreateNoteParams): Promise<Note> {
  const { data } = await apiClient.post('/smart-notes/notes', params)
  return data
}

export async function updateNote(id: string, params: UpdateNoteParams): Promise<Note> {
  const { data } = await apiClient.put(`/smart-notes/notes/${id}`, params)
  return data
}

export async function deleteNote(id: string): Promise<void> {
  await apiClient.delete(`/smart-notes/notes/${id}`)
}

export async function moveNote(id: string, folderId: string | null): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${id}/move`, { folderId })
  return data
}

export async function archiveNote(id: string): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${id}/archive`)
  return data
}

export async function unarchiveNote(id: string): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${id}/unarchive`)
  return data
}

export async function pinNote(id: string): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${id}/pin`)
  return data
}

export async function unpinNote(id: string): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${id}/unpin`)
  return data
}

// Search
export async function searchNotes(params: SearchNotesParams): Promise<NotePreview[]> {
  const { data } = await apiClient.get('/smart-notes/notes/search', { params: { q: params.query } })
  return data.notes ?? data
}

// Tags
export async function listTags(): Promise<Tag[]> {
  const { data } = await apiClient.get('/smart-notes/tags')
  return data
}

export async function addTagToNote(noteId: string, tagName: string): Promise<Note> {
  const { data } = await apiClient.post(`/smart-notes/notes/${noteId}/tags`, { tagName })
  return data
}

export async function removeTagFromNote(noteId: string, tagName: string): Promise<Note> {
  const { data } = await apiClient.delete(`/smart-notes/notes/${noteId}/tags/${tagName}`)
  return data
}

// Context
export async function previewContext(): Promise<ContextPreview> {
  const { data } = await apiClient.get('/smart-notes/preview-context')
  return data
}
