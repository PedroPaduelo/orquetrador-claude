import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConversationsStore } from '../store'
import type { Action } from '../types'

interface UseSSEStreamOptions {
  conversationId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

export function useSSEStream(options: UseSSEStreamOptions) {
  const { conversationId, onComplete, onError } = options
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    isStreaming,
    streamingContent,
    streamingActions,
    setStreaming,
    appendStreamingContent,
    addStreamingAction,
    clearStreaming,
    setProgress,
    setStepStatus,
  } = useConversationsStore()

  const sendMessage = useCallback(
    async (content: string, stepIndex?: number) => {
      if (isStreaming) return

      setStreaming(true)
      clearStreaming()
      setStreaming(true) // Set again after clear

      abortControllerRef.current = new AbortController()

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
        const response = await fetch(
          `${apiUrl}/conversations/${conversationId}/messages/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, stepIndex }),
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) throw new Error('No reader available')

        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.slice(5).trim())
                handleEvent(currentEvent, data)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        onComplete?.()
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          onError?.((error as Error).message)
        }
      } finally {
        setStreaming(false)
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      }
    },
    [conversationId, isStreaming, queryClient, onComplete, onError]
  )

  const handleEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case 'step_start':
          setProgress(
            (data.stepOrder as number) - 1,
            data.totalSteps as number
          )
          setStepStatus(data.stepId as string, 'running')
          break

        case 'stream':
          if (data.type === 'content' && data.content) {
            appendStreamingContent(data.content as string)
          } else if (data.type === 'action' && data.action) {
            addStreamingAction(data.action as Action)
          }
          break

        case 'step_complete':
          // Mark as 'active' (not 'completed') - the step stays open for more messages.
          // Steps only become 'completed' when the user advances past them.
          setStepStatus(data.stepId as string, 'active')
          break

        case 'step_error':
          setStepStatus(data.stepId as string, 'error')
          onError?.(data.error as string)
          break

        case 'condition_retry':
          setStepStatus(data.stepId as string, 'retry')
          break

        case 'error':
          onError?.(data.message as string)
          break

        case 'complete':
          onComplete?.()
          break
      }
    },
    [setProgress, setStepStatus, appendStreamingContent, addStreamingAction, onError, onComplete]
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setStreaming(false)
  }, [setStreaming])

  return {
    sendMessage,
    cancel,
    isStreaming,
    streamingContent,
    streamingActions,
  }
}
