export interface Action {
  type: 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'stderr'
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

    // Split by newlines and process each line
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      try {
        const data = JSON.parse(trimmedLine)
        const parsedEvents = this.parseJsonEvent(data)
        events.push(...parsedEvents)
      } catch {
        // Not JSON, might be raw output
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

    // Log every JSON event type for debugging
    console.log(`[StreamParser] Event type: ${obj.type}${obj.subtype ? '/' + obj.subtype : ''} keys: ${Object.keys(obj).join(',')}`)

    // Handle system events (init, etc.) - these contain session_id too
    if (obj.type === 'system') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }
      return events
    }

    // Handle result event (final event, contains session ID and cost info)
    if (obj.type === 'result') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }

      // Check for error in result
      if (obj.subtype === 'error' || obj.is_error) {
        const errorMsg = (obj.error as string) || (obj.result as string) || 'Unknown error in result'
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

    // Handle assistant message
    if (obj.type === 'assistant' && obj.message) {
      const message = obj.message as Record<string, unknown>
      const content = message.content as Array<Record<string, unknown>>

      if (Array.isArray(content)) {
        for (const block of content) {
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

    // Handle user message (tool results)
    if (obj.type === 'user' && obj.message) {
      const message = obj.message as Record<string, unknown>
      const content = message.content as Array<Record<string, unknown>>

      if (Array.isArray(content)) {
        for (const block of content) {
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

    // Handle content block deltas (streaming)
    if (obj.type === 'content_block_delta' && obj.delta) {
      const delta = obj.delta as Record<string, unknown>
      if (delta.type === 'text_delta' && delta.text) {
        events.push({
          type: 'content',
          content: delta.text as string,
        })
      }
      return events
    }

    // Handle stream_event wrapper (when using --include-partial-messages or newer CLI versions)
    if (obj.type === 'stream_event' && obj.event) {
      const event = obj.event as Record<string, unknown>
      if (event.type === 'content_block_delta' && event.delta) {
        const delta = event.delta as Record<string, unknown>
        if (delta.type === 'text_delta' && delta.text) {
          events.push({
            type: 'content',
            content: delta.text as string,
          })
        }
      }
      return events
    }

    // Unknown event type - log it
    console.log(`[StreamParser] Unhandled event type: ${obj.type}, full: ${JSON.stringify(obj).substring(0, 300)}`)

    return events
  }

  reset() {
    this.buffer = ''
    this.currentToolUse = null
  }
}
