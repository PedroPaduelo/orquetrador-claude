export interface SmartNotesStatus {
  configured: boolean
  connected: boolean
  serverUrl?: string | null
  error?: string | null
}

export interface Folder {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  parentId?: string | null
  noteCount?: number
  children?: Folder[]
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface Tag {
  id: string
  name: string
  color?: string | null
  noteCount?: number
}

export interface Note {
  id: string
  title: string
  content?: string
  contentType?: string
  folderId?: string | null
  isPinned?: boolean
  isArchived?: boolean
  tags?: (Tag | string)[]
  createdAt?: string
  updatedAt?: string
}

export interface NotePreview {
  id: string
  title: string
  contentPreview?: string
  content?: string
  contentType?: string
  folderId?: string | null
  isPinned?: boolean
  isArchived?: boolean
  tags?: (Tag | string)[]
  createdAt?: string
  updatedAt?: string
}

export interface ContextPreview {
  folders: Array<{
    id: string
    name: string
    selected: boolean
    noteCount: number
  }>
  notes: Array<{
    id: string
    title: string
    selected: boolean
    preview: string
  }>
  estimatedTokens: number
}

export interface SearchResult {
  notes: NotePreview[]
  total: number
}

// API Params
export interface ListNotesParams {
  folderId?: string
  tagId?: string
  isArchived?: boolean
  limit?: number
  offset?: number
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchNotesParams {
  query: string
  limit?: number
  offset?: number
}

export interface CreateNoteParams {
  title: string
  content: string
  contentType?: 'richtext' | 'html'
  folderId?: string
  tags?: string[]
  isPinned?: boolean
}

export interface UpdateNoteParams {
  title?: string
  content?: string
  tags?: string[]
}

export interface CreateFolderParams {
  name: string
  icon?: string
  color?: string
  parentId?: string
}

export interface UpdateFolderParams {
  name?: string
  icon?: string
  color?: string
  parentId?: string
}
