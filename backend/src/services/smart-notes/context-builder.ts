import { smartNotesMCPClient } from './mcp-client.js'
import type { WorkflowStep } from '@prisma/client'

export class SmartNotesContextBuilder {
  async buildSystemPrompt(step: WorkflowStep): Promise<string> {
    const parts: string[] = []

    // 1. Memory notes (base knowledge)
    let memoryNoteIds: string[] = []
    try { memoryNoteIds = typeof step.memoryNoteIds === 'string' ? JSON.parse(step.memoryNoteIds) : (step.memoryNoteIds as string[]) || [] } catch { /* ignore */ }
    if (memoryNoteIds && memoryNoteIds.length > 0 && smartNotesMCPClient.isConfigured()) {
      try {
        const memoryContent = await this.getMemoryContent(memoryNoteIds)
        if (memoryContent) {
          parts.push(`## Memoria do Projeto\n\n${memoryContent}`)
        }
      } catch (error) {
        console.error('Error fetching memory notes:', error)
      }
    }

    // 2. Context notes (specific context)
    let contextNoteIds: string[] = []
    try { contextNoteIds = typeof step.contextNoteIds === 'string' ? JSON.parse(step.contextNoteIds) : (step.contextNoteIds as string[]) || [] } catch { /* ignore */ }
    if (contextNoteIds && contextNoteIds.length > 0 && smartNotesMCPClient.isConfigured()) {
      try {
        const contextContent = await this.getContextContent(contextNoteIds)
        if (contextContent) {
          parts.push(`## Contexto\n\n${contextContent}`)
        }
      } catch (error) {
        console.error('Error fetching context notes:', error)
      }
    }

    // 3. System prompt (main instruction)
    if (step.systemPromptNoteId && smartNotesMCPClient.isConfigured()) {
      try {
        const note = await smartNotesMCPClient.getNote(step.systemPromptNoteId)
        parts.push(`## Instrucoes\n\n${note.content}`)
      } catch (error) {
        console.error('Error fetching system prompt note:', error)
        // Fallback to text system prompt
        if (step.systemPrompt) {
          parts.push(`## Instrucoes\n\n${step.systemPrompt}`)
        }
      }
    } else if (step.systemPrompt) {
      parts.push(`## Instrucoes\n\n${step.systemPrompt}`)
    }

    return parts.join('\n\n---\n\n')
  }

  private async getMemoryContent(noteIds: string[]): Promise<string> {
    const notes = await smartNotesMCPClient.getNotesBatch(noteIds)

    return notes
      .map((note) => `### ${note.title}\n\n${note.content}`)
      .join('\n\n')
  }

  private async getContextContent(noteIds: string[]): Promise<string> {
    const notes = await smartNotesMCPClient.getNotesBatch(noteIds)

    return notes
      .map((note) => `### ${note.title}\n\n${note.content}`)
      .join('\n\n---\n\n')
  }

  async previewContext(
    systemPromptNoteId?: string,
    contextNoteIds?: string[],
    memoryNoteIds?: string[]
  ): Promise<string> {
    const parts: string[] = []

    if (memoryNoteIds && memoryNoteIds.length > 0) {
      const memoryContent = await this.getMemoryContent(memoryNoteIds)
      if (memoryContent) {
        parts.push(`## Memoria do Projeto\n\n${memoryContent}`)
      }
    }

    if (contextNoteIds && contextNoteIds.length > 0) {
      const contextContent = await this.getContextContent(contextNoteIds)
      if (contextContent) {
        parts.push(`## Contexto\n\n${contextContent}`)
      }
    }

    if (systemPromptNoteId) {
      const note = await smartNotesMCPClient.getNote(systemPromptNoteId)
      parts.push(`## Instrucoes\n\n${note.content}`)
    }

    return parts.join('\n\n---\n\n')
  }
}

export const smartNotesService = new SmartNotesContextBuilder()
