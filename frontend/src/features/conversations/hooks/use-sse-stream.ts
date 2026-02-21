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
  const cancelledRef = useRef(false)

  const {
    isStreaming,
    streamingContent,
    streamingActions,
    setStreaming,
    appendStreamingContent,
    addStreamingAction,
    clearStreaming,
    resetStreamingContent,
    setProgress,
    setStepStatus,
  } = useConversationsStore()

  const sendMessage = useCallback(
    async (content: string, stepIndex?: number) => {
      if (isStreaming) return

      cancelledRef.current = false
      clearStreaming()
      setStreaming(true)

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
        if (!cancelledRef.current) {
          // Normal completion — refetch then stop streaming
          try {
            await queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
          } catch {
            // Ignore refetch errors
          }
          setStreaming(false)
        }
        // If cancelled, cancel() already handled setStreaming(false)
      }
    },
    [conversationId, isStreaming, queryClient, onComplete, onError]
  )

  const handleEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case 'step_start': {
          // Mark any previously running/active steps as completed
          const { stepStatuses } = useConversationsStore.getState()
          stepStatuses.forEach((status, id) => {
            if (status === 'running' || status === 'active') {
              setStepStatus(id, 'completed')
            }
          })

          setProgress(
            (data.stepOrder as number) - 1,
            data.totalSteps as number
          )
          setStepStatus(data.stepId as string, 'running')
          resetStreamingContent()
          break
        }

        case 'stream':
          if (data.type === 'content' && data.content) {
            appendStreamingContent(data.content as string)
          } else if (data.type === 'action' && data.action) {
            addStreamingAction(data.action as Action)
          }
          break

        case 'step_complete':
          if (data.finished) {
            setStepStatus(data.stepId as string, 'completed')
          } else {
            setStepStatus(data.stepId as string, 'active')
          }
          break

        case 'step_error':
          setStepStatus(data.stepId as string, 'error')
          onError?.(data.error as string)
          break

        case 'condition_retry':
          setStepStatus(data.stepId as string, 'retry')
          break

        case 'condition_jump':
          resetStreamingContent()
          break

        case 'error':
          onError?.(data.message as string)
          break

        case 'complete':
          onComplete?.()
          break
      }
    },
    [setProgress, setStepStatus, appendStreamingContent, addStreamingAction, resetStreamingContent, onError, onComplete]
  )

  const cancel = useCallback(async () => {
    // Mark as cancelled so sendMessage's finally doesn't interfere
    cancelledRef.current = true

    // Abort the HTTP connection immediately
    abortControllerRef.current?.abort()

    // Stop streaming UI immediately
    setStreaming(false)

    // Clear any 'running' step statuses so the spinner stops
    const { stepStatuses, setStepStatus: updateStepStatus } = useConversationsStore.getState()
    stepStatuses.forEach((status, id) => {
      if (status === 'running') {
        updateStepStatus(id, 'cancelled')
      }
    })

    // Cancel backend execution
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      await fetch(`${apiUrl}/conversations/${conversationId}/cancel`, {
        method: 'POST',
      })
    } catch {
      // Ignore cancel API errors
    }

    // Refetch conversation to get latest state
    queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
  }, [conversationId, setStreaming, queryClient])

  return {
    sendMessage,
    cancel,
    isStreaming,
    streamingContent,
    streamingActions,
  }
}
