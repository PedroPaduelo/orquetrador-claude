import { env } from '../../lib/env.js'

interface MCPResponse {
  jsonrpc: string
  id: number
  result?: {
    content: Array<{ type: string; text: string }>
  }
  error?: {
    code: number
    message: string
  }
}

export interface Note {
  [k: string]: unknown
  id: string
  title: string
  content?: string
  contentPreview?: string
  contentType?: string
  folderId?: string
  isPinned?: boolean
  isArchived?: boolean
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface Folder {
  [k: string]: unknown
  id: string
  name: string
  icon?: string
  color?: string
  noteCount?: number
  children?: Folder[]
}

export class SmartNotesMCPClient {
  private baseUrl: string | undefined
  private apiKey: string | undefined

  constructor() {
    // Strip /api/mcp/execute suffix if present, since execute() appends it
    let url = env.SMART_NOTES_API_URL
    if (url) {
      url = url.replace(/\/api\/mcp\/execute\/?$/, '').replace(/\/+$/, '')
    }
    this.baseUrl = url
    this.apiKey = env.SMART_NOTES_API_KEY
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey)
  }

  private async execute<T>(method: string, args: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Smart Notes is not configured')
    }

    const response = await fetch(`${this.baseUrl}/api/mcp/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: method, arguments: args },
      }),
    })

    if (!response.ok) {
      throw new Error(`Smart Notes API error: ${response.status}`)
    }

    const data: MCPResponse = await response.json()

    if (data.error) {
      throw new Error(`Smart Notes error: ${data.error.message}`)
    }

    if (!data.result?.content?.[0]?.text) {
      throw new Error('Invalid Smart Notes response')
    }

    return JSON.parse(data.result.content[0].text)
  }

  async getNote(id: string): Promise<Note> {
    return this.execute('get_note', { id })
  }

  async listNotes(folderId?: string): Promise<{ notes: Note[] }> {
    const result = await this.execute<{ notes: Note[] } | Note[]>('list_notes', folderId ? { folderId } : {})
    if (Array.isArray(result)) {
      return { notes: result }
    }
    return result
  }

  async listFolders(): Promise<Folder[]> {
    const result = await this.execute<Folder[] | { folders: Folder[] }>('list_folders', { asTree: 'true' })
    if (Array.isArray(result)) {
      return result
    }
    return result.folders || []
  }

  async searchNotes(query: string): Promise<{ notes: Note[] }> {
    const result = await this.execute<{ notes: Note[] } | Note[]>('search_notes', { query })
    if (Array.isArray(result)) {
      return { notes: result }
    }
    return result
  }

  async createNote(params: { title: string; content: string; contentType?: string; folderId?: string; tags?: string[]; isPinned?: boolean }): Promise<Note> {
    return this.execute('create_note', params as Record<string, unknown>)
  }

  async updateNote(id: string, params: { title?: string; content?: string; tags?: string[] }): Promise<Note> {
    return this.execute('update_note', { id, ...params } as Record<string, unknown>)
  }

  async deleteNote(id: string): Promise<void> {
    await this.execute('delete_note', { id })
  }

  async moveNote(id: string, folderId: string | null): Promise<Note> {
    return this.execute('move_note', { id, folderId: folderId || '' })
  }

  async archiveNote(id: string): Promise<Note> {
    return this.execute('archive_note', { id })
  }

  async unarchiveNote(id: string): Promise<Note> {
    return this.execute('unarchive_note', { id })
  }

  async pinNote(id: string): Promise<Note> {
    return this.execute('pin_note', { id })
  }

  async unpinNote(id: string): Promise<Note> {
    return this.execute('unpin_note', { id })
  }

  async createFolder(params: { name: string; icon?: string; color?: string; parentId?: string }): Promise<Folder> {
    return this.execute('create_folder', params as Record<string, unknown>)
  }

  async updateFolder(id: string, params: { name?: string; icon?: string; color?: string; parentId?: string }): Promise<Folder> {
    return this.execute('update_folder', { id, ...params } as Record<string, unknown>)
  }

  async deleteFolder(id: string): Promise<void> {
    await this.execute('delete_folder', { id })
  }

  async addTagToNote(noteId: string, tagName: string): Promise<Note> {
    return this.execute('add_tag_to_note', { noteId, tagName })
  }

  async removeTagFromNote(noteId: string, tagName: string): Promise<Note> {
    return this.execute('remove_tag_from_note', { noteId, tagName })
  }

  async getNotesBatch(ids: string[]): Promise<Note[]> {
    const results = await Promise.allSettled(ids.map((id) => this.getNote(id)))
    return results
      .filter((r): r is PromiseFulfilledResult<Note> => r.status === 'fulfilled')
      .map((r) => r.value)
  }
}

export const smartNotesMCPClient = new SmartNotesMCPClient()
