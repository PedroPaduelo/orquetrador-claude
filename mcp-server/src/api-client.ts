const BASE_URL = process.env.EXECUT_API_URL || 'http://localhost:3333'

interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

// Per-session API key storage
const sessionApiKeys: Record<string, string> = {}

export function setSessionApiKey(sessionId: string, apiKey: string) {
  sessionApiKeys[sessionId] = apiKey
}

export function removeSessionApiKey(sessionId: string) {
  delete sessionApiKeys[sessionId]
}

// Active session context (set before each tool call)
let currentSessionId: string | undefined

export function setCurrentSession(sessionId: string | undefined) {
  currentSessionId = sessionId
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = currentSessionId ? sessionApiKeys[currentSessionId] : undefined
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

export async function apiGet<T = unknown>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
  const data = res.ok ? await res.json() as T : (await res.text() as unknown as T)
  return { ok: res.ok, status: res.status, data }
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiDelete<T = unknown>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: authHeaders() })
  if (res.status === 204) return { ok: true, status: 204, data: null as T }
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

// SSE result from streaming execution
export interface SSEResult {
  executionId: string
  content: string
  stepsCompleted: Array<{ stepName: string; stepOrder: number; contentLength: number }>
  error: string | null
}

/**
 * POST to an SSE endpoint, consume the full stream, and return the aggregated result.
 * Used for conversation message execution (send message → wait for workflow completion).
 */
export async function apiPostSSE(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<ApiResponse<SSEResult>> {
  const timeoutMs = options?.timeoutMs || 600000 // 10 minutes default

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, status: res.status, data: { executionId: '', content: '', stepsCompleted: [], error: text } }
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const stepsCompleted: SSEResult['stepsCompleted'] = []
    let finalContent = ''
    let error: string | null = null
    let executionId = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n')
      buffer = parts.pop()! // Keep incomplete part

      for (const part of parts) {
        const lines = part.split('\n')
        let eventType = ''
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6)
          }
        }

        if (!eventType || !eventData) continue

        try {
          const data = JSON.parse(eventData)

          if (data.executionId) executionId = data.executionId

          switch (eventType) {
            case 'step_complete':
              finalContent = data.content || finalContent
              stepsCompleted.push({
                stepName: data.stepName || 'unknown',
                stepOrder: data.stepOrder || stepsCompleted.length + 1,
                contentLength: (data.content || '').length,
              })
              break
            case 'step_error':
              error = data.error || 'Unknown step error'
              break
            case 'error':
              error = data.message || 'Unknown error'
              break
            case 'cancelled':
              error = 'Execution was cancelled'
              break
          }
        } catch {
          // Ignore unparseable events
        }
      }
    }

    return {
      ok: !error,
      status: error ? 500 : 200,
      data: { executionId, content: finalContent, stepsCompleted, error },
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      status: 408,
      data: {
        executionId: '',
        content: '',
        stepsCompleted: [],
        error: isAbort ? `Timeout after ${timeoutMs}ms. Use conversation_send_message_async for long-running workflows.` : String(err),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function formatResult(res: ApiResponse): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (!res.ok) {
    return {
      content: [{ type: 'text', text: `Error (${res.status}): ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)}` }],
      isError: true,
    }
  }
  return {
    content: [{ type: 'text', text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2) }],
  }
}
