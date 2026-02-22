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

    // Split by newlines and process each complete line
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete last line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      try {
        const data = JSON.parse(trimmedLine)
        const parsedEvents = this.parseJsonEvent(data)
        events.push(...parsedEvents)
      } catch {
        // Not valid JSON - might be raw text output
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

    // Log every JSON event type for debugging
    console.log(`[StreamParser] Event type: ${type}${obj.subtype ? '/' + obj.subtype : ''} keys: ${Object.keys(obj).join(',')}`)

    // ---- system events (init, compact_boundary) ----
    if (type === 'system') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }
      return events
    }

    // ---- result event (terminal event with metrics) ----
    if (type === 'result') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }

      // Check for error in result
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

    // ---- assistant message (text + tool_use + thinking blocks) ----
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

    // ---- user message (tool results) ----
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

    // ---- stream_event (token-level streaming with --include-partial-messages) ----
    if (type === 'stream_event' && obj.event) {
      const event = obj.event as Record<string, unknown>

      // content_block_delta - incremental text/tool_input/thinking
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

      // content_block_start - beginning of a tool_use block
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

    // ---- content_block_delta (direct, not wrapped in stream_event) ----
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

    // ---- progress events (hook progress, etc.) - ignore silently ----
    if (type === 'progress') {
      return events
    }

    // Unknown event type - log but don't treat as error
    console.log(`[StreamParser] Unhandled event type: ${type}, keys: ${Object.keys(obj).join(',')}`)

    return events
  }

  reset() {
    this.buffer = ''
    this.currentToolUse = null
  }
}
