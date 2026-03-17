export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  server_tool_use?: {
    web_search_requests: number
    web_fetch_requests: number
  }
}

export interface Action {
  type: 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'stderr' | 'system'
  name?: string
  input?: unknown
  output?: unknown
  content?: string
  id?: string
  message?: string
}

export interface McpServerStatus {
  name: string
  status: 'connected' | 'failed' | string
  error?: string
}

export interface Metadata {
  // From system.init
  claude_code_version?: string
  output_style?: string
  fast_mode_state?: string
  permission_mode?: string
  session_id?: string
  model?: string
  mcp_servers?: McpServerStatus[]
  tools?: string[]
  // From result
  total_cost_usd?: number
  duration_api_ms?: number
  num_turns?: number
  stop_reason?: string
  service_tier?: string
  inference_geo?: string
  iterations?: unknown[]
  model_usage?: Record<string, unknown>
  permission_denials?: unknown[]
  cache_creation?: Record<string, unknown>
  web_search_requests?: number
  web_fetch_requests?: number
}

export interface StreamEvent {
  type: 'content' | 'action' | 'session' | 'result' | 'error' | 'usage' | 'metadata'
  content?: string
  action?: Action
  sessionId?: string
  result?: string
  error?: string
  usage?: Usage
  metadata?: Metadata
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
    const subtype = obj.subtype as string

    if (type === 'system') {
      if (obj.session_id) {
        events.push({
          type: 'session',
          sessionId: obj.session_id as string,
        })
      }

      // Extract metadata from system.init event
      if (subtype === 'init') {
        const mcpServers = Array.isArray(obj.mcp_servers)
          ? (obj.mcp_servers as Array<Record<string, unknown>>).map(s => ({
              name: s.name as string,
              status: s.status as string,
              error: s.error as string | undefined,
            }))
          : undefined

        events.push({
          type: 'metadata',
          metadata: {
            claude_code_version: obj.claude_code_version as string | undefined,
            output_style: obj.output_style as string | undefined,
            fast_mode_state: obj.fast_mode_state as string | undefined,
            permission_mode: obj.permissionMode as string | undefined,
            session_id: obj.session_id as string | undefined,
            model: obj.model as string | undefined,
            mcp_servers: mcpServers,
            tools: Array.isArray(obj.tools) ? obj.tools as string[] : undefined,
          },
        })

        // Log MCP server failures for debugging
        if (mcpServers) {
          const failed = mcpServers.filter(s => s.status !== 'connected')
          if (failed.length > 0) {
            console.warn(`[StreamParser] MCP servers with failures: ${failed.map(s => `${s.name}(${s.status})`).join(', ')}`)
          }
        }
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
        const extractMsg = (val: unknown): string => {
          if (!val) return ''
          if (typeof val === 'string') return val
          if (Array.isArray(val)) return val.join('; ')
          if (typeof val === 'object') {
            const o = val as Record<string, unknown>
            if (typeof o.message === 'string') return o.message
            if (typeof o.error === 'string') return o.error
            try { return JSON.stringify(val) } catch { return String(val) }
          }
          return String(val)
        }
        const errorMsg = extractMsg(obj.errors) || extractMsg(obj.error) || extractMsg(obj.result) || extractMsg(obj.message) || `Error: ${obj.subtype}`
        events.push({
          type: 'error',
          error: errorMsg,
        })
        return events
      }

      // Extract metadata from result event
      events.push({
        type: 'metadata',
        metadata: {
          total_cost_usd: obj.total_cost_usd as number | undefined,
          duration_api_ms: obj.duration_api_ms as number | undefined,
          num_turns: obj.num_turns as number | undefined,
          stop_reason: obj.stop_reason as string | undefined,
          service_tier: obj.service_tier as string | undefined,
          inference_geo: obj.inference_geo as string | undefined,
          iterations: obj.iterations as unknown[] | undefined,
          model_usage: obj.modelUsage as Record<string, unknown> | undefined,
          permission_denials: obj.permission_denials as unknown[] | undefined,
        },
      })

      // Extract usage from result event
      if (obj.usage) {
        const usage = obj.usage as Record<string, unknown>
        const serverToolUse = usage.server_tool_use as Record<string, unknown> | undefined
        events.push({
          type: 'usage',
          usage: {
            input_tokens: (usage.input_tokens as number) || 0,
            output_tokens: (usage.output_tokens as number) || 0,
            cache_creation_input_tokens: (usage.cache_creation_input_tokens as number) || 0,
            cache_read_input_tokens: (usage.cache_read_input_tokens as number) || 0,
            server_tool_use: serverToolUse ? {
              web_search_requests: (serverToolUse.web_search_requests as number) || 0,
              web_fetch_requests: (serverToolUse.web_fetch_requests as number) || 0,
            } : undefined,
          },
        })
      }

      // Extract cache_creation metadata
      if (obj.cache_creation) {
        events.push({
          type: 'metadata',
          metadata: {
            cache_creation: obj.cache_creation as Record<string, unknown> | undefined,
          },
        })
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

      // Extract usage from assistant message
      if (message.usage) {
        const usage = message.usage as Record<string, unknown>
        events.push({
          type: 'usage',
          usage: {
            input_tokens: (usage.input_tokens as number) || 0,
            output_tokens: (usage.output_tokens as number) || 0,
            cache_creation_input_tokens: (usage.cache_creation_input_tokens as number) || 0,
            cache_read_input_tokens: (usage.cache_read_input_tokens as number) || 0,
          },
        })
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
