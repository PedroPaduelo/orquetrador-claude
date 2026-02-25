export interface Action {
  type: 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'stderr' | 'system'
  name?: string
  input?: unknown
  output?: unknown
  content?: string
  id?: string
  message?: string
}

export interface StreamEvent {
  type: 'content' | 'action' | 'session' | 'result' | 'error'
  content?: string
  action?: Action
  sessionId?: string
  result?: string
  error?: string
}

export class StreamParser {
  private buffer = ''
  private currentToolUse: { name: string; input: string; id: string } | null = null

  parse(chunk: string): StreamEvent[] {
    this.buffer += chunk
    const events: StreamEvent[] = []

    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      try {
        const data = JSON.parse(trimmedLine)
        const parsedEvents = this.parseJsonEvent(data)
        events.push(...parsedEvents)
      } catch {
        if (trimmedLine) {
          events.push({ type: 'content', content: trimmedLine })
        }
      }
    }

    return events
  }

  private parseJsonEvent(data: unknown): StreamEvent[] {
    const events: StreamEvent[] = []

    if (!data || typeof data !== 'object') return events

    const obj = data as Record<string, unknown>
    const type = obj.type as string

    if (type === 'system') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }
      return events
    }

    if (type === 'result') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }

      if (obj.subtype === 'error_during_execution' ||
          obj.subtype === 'error_max_turns' ||
          obj.subtype === 'error_max_budget_usd' ||
          obj.is_error === true) {
        const errorMsg = (obj.error as string) || (obj.result as string) || `Error: ${obj.subtype}`
        events.push({
          type: 'error',
          error: errorMsg,
        })
        return events
      }

      if (obj.result) {
        events.push({
          type: 'result',
          result: obj.result as string,
        })
      }
      return events
    }

    if (type === 'assistant' && obj.message) {
      const message = obj.message as Record<string, unknown>
      const contentBlocks = message.content as Array<Record<string, unknown>>

      if (Array.isArray(contentBlocks)) {
        for (const block of contentBlocks) {
          if (block.type === 'text' && block.text) {
            events.push({
              type: 'content',
              content: block.text as string,
            })
          } else if (block.type === 'tool_use') {
            this.currentToolUse = {
              name: block.name as string,
              input: JSON.stringify(block.input),
              id: block.id as string,
            }
            events.push({
              type: 'action',
              action: {
                type: 'tool_use',
                name: block.name as string,
                input: block.input,
                id: block.id as string,
              },
            })
          } else if (block.type === 'thinking' && block.thinking) {
            events.push({
              type: 'action',
              action: {
                type: 'thinking',
                content: block.thinking as string,
              },
            })
          }
        }
      }
      return events
    }

    if (type === 'user' && obj.message) {
      const message = obj.message as Record<string, unknown>
      const contentBlocks = message.content as Array<Record<string, unknown>>

      if (Array.isArray(contentBlocks)) {
        for (const block of contentBlocks) {
          if (block.type === 'tool_result') {
            events.push({
              type: 'action',
              action: {
                type: 'tool_result',
                name: this.currentToolUse?.name,
                output: block.content,
                id: block.tool_use_id as string,
              },
            })
          }
        }
      }
      return events
    }

    if (type === 'stream_event' && obj.event) {
      const event = obj.event as Record<string, unknown>

      if (event.type === 'content_block_delta' && event.delta) {
        const delta = event.delta as Record<string, unknown>
        if (delta.type === 'text_delta' && delta.text) {
          events.push({
            type: 'content',
            content: delta.text as string,
          })
        } else if (delta.type === 'thinking_delta' && delta.thinking) {
          events.push({
            type: 'action',
            action: {
              type: 'thinking',
              content: delta.thinking as string,
            },
          })
        }
      }

      if (event.type === 'content_block_start') {
        const contentBlock = event.content_block as Record<string, unknown> | undefined
        if (contentBlock?.type === 'tool_use') {
          this.currentToolUse = {
            name: contentBlock.name as string,
            input: '',
            id: contentBlock.id as string,
          }
        }
      }

      return events
    }

    if (type === 'content_block_delta' && obj.delta) {
      const delta = obj.delta as Record<string, unknown>
      if (delta.type === 'text_delta' && delta.text) {
        events.push({
          type: 'content',
          content: delta.text as string,
        })
      }
      return events
    }

    if (type === 'progress') {
      return events
    }

    return events
  }

  reset() {
    this.buffer = ''
    this.currentToolUse = null
  }
}
