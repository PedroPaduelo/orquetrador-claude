export interface SSEEvent {
  event: string
  data: unknown
}

export type SSEEventHandler = (event: string, data: unknown) => void

export interface SSEOptions {
  url: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  onEvent: SSEEventHandler
  onError?: (error: Error) => void
  onComplete?: () => void
}

export async function createSSEConnection(options: SSEOptions): Promise<AbortController> {
  const { url, method = 'POST', body, headers = {}, onEvent, onError, onComplete } = options

  const abortController = new AbortController()

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No reader available')
    }

    let buffer = ''

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            onComplete?.()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEvent = ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.slice(5).trim())
                onEvent(currentEvent, data)
              } catch {
                // Ignore JSON parse errors for malformed data
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          onError?.(error as Error)
        }
      }
    }

    processStream()
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      onError?.(error as Error)
    }
  }

  return abortController
}
