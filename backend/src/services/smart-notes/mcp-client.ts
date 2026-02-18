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
  id: string
  title: string
  content: string
  folderId?: string
  tags?: string[]
  contentPreview?: string
}

export interface Folder {
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
    this.baseUrl = env.SMART_NOTES_API_URL
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
    return this.execute('list_notes', folderId ? { folderId } : {})
  }

  async listFolders(): Promise<{ folders: Folder[] }> {
    return this.execute('list_folders', { asTree: 'true' })
  }

  async searchNotes(query: string): Promise<{ notes: Note[] }> {
    return this.execute('search_notes', { query })
  }

  async getNotesBatch(ids: string[]): Promise<Note[]> {
    const results = await Promise.allSettled(ids.map((id) => this.getNote(id)))
    return results
      .filter((r): r is PromiseFulfilledResult<Note> => r.status === 'fulfilled')
      .map((r) => r.value)
  }
}

export const smartNotesMCPClient = new SmartNotesMCPClient()
