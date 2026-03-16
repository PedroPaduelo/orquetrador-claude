import { useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConversationsStore } from '../store'
import type { Action, Attachment, Conversation } from '../types'

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
  const firstContentReceivedRef = useRef(false)

  const {
    isStreaming,
    streamingPhase,
    streamingContent,
    streamingActions,
    isPaused,
    pausedInfo,
    setStreaming,
    setStreamingPhase,
    appendStreamingContent,
    addStreamingAction,
    clearStreaming,
    resetStreamingContent,
    setPaused,
    setProgress,
    setStepStatus,
    setInterrupting,
  } = useConversationsStore()

  const sendMessage = useCallback(
    async (content: string, stepIndex?: number, attachments?: Attachment[]) => {
      if (isStreaming) return

      cancelledRef.current = false
      firstContentReceivedRef.current = false
      setPaused(false) // Clear paused state when sending new message
      clearStreaming()
      setStreaming(true)
      // Phase: preparing (sending to backend)
      setStreamingPhase('preparing')

      abortControllerRef.current = new AbortController()

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'

        // Phase: connecting (HTTP request in flight)
        setStreamingPhase('connecting')

        const token = localStorage.getItem('token')
        const response = await fetch(
          `${apiUrl}/conversations/${conversationId}/messages/stream`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ content, stepIndex, attachments }),
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          let errorDetails = `HTTP error! status: ${response.status}`
          try {
            const errorData = await response.json()
            if (errorData.message || errorData.error) {
              errorDetails = errorData.message || errorData.error
            }
          } catch {
            // Ignore JSON parse errors
          }
          throw new Error(errorDetails)
        }

        // Phase: AI is thinking (SSE connected, waiting for content)
        setStreamingPhase('ai_thinking')

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
          try {
            await queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
            await queryClient.invalidateQueries({ queryKey: ['token-usage', conversationId] })
            await queryClient.invalidateQueries({ queryKey: ['execution-stats', conversationId] })
          } catch {
            // Ignore refetch errors
          }
          setStreaming(false)
        }
      }
    },
    [conversationId, isStreaming, queryClient, onComplete, onError, setPaused]
  )

  const handleEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case 'step_start': {
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
          // Step started -> AI is thinking
          setStreamingPhase('ai_thinking')
          firstContentReceivedRef.current = false
          break
        }

        case 'stream':
          if (data.type === 'content' && data.content) {
            // First content received -> now streaming
            if (!firstContentReceivedRef.current) {
              firstContentReceivedRef.current = true
              setStreamingPhase('streaming')
            }
            appendStreamingContent(data.content as string)
          } else if (data.type === 'action' && data.action) {
            const action = data.action as Action
            addStreamingAction(action)
            // When meaningful actions arrive (tool_use, thinking, tool_result),
            // transition to streaming so user sees the AI is actively working
            if (!firstContentReceivedRef.current) {
              if (action.type === 'tool_use' || action.type === 'thinking' || action.type === 'tool_result') {
                firstContentReceivedRef.current = true
                setStreamingPhase('streaming')
              }
            }
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

        case 'context_reset':
          // Context was too large, orchestrator is retrying with a fresh session
          resetStreamingContent()
          setStepStatus(data.stepId as string, 'running')
          setStreamingPhase('ai_thinking')
          firstContentReceivedRef.current = false
          // Emit a visible action so the user knows what happened
          addStreamingAction({
            type: 'system',
            content: data.reason as string || '🔄 O contexto ficou muito longo e foi compactado. A sessão será reiniciada automaticamente.',
          })
          break

        case 'message_saved': {
          // Inserir a mensagem no cache do React Query em tempo real
          // para que apareça no chat sem esperar o refetch final
          const queryKey = ['conversations', conversationId, 'detail']
          queryClient.setQueryData<Conversation>(queryKey, (old) => {
            if (!old) return old
            const existingIds = new Set(old.messages?.map(m => m.id) || [])
            if (existingIds.has(data.messageId as string)) return old
            const newMessage = {
              id: data.messageId as string,
              role: data.role as 'user' | 'assistant',
              content: data.content as string,
              stepId: (data.stepId as string) || null,
              stepName: (data.stepName as string) || null,
              selectedForContext: false,
              metadata: data.metadata ? { actions: (data.metadata as Record<string, unknown>).actions as Action[] || [] } : undefined,
              attachments: (data.attachments as Array<{
                id: string
                filename: string
                mimeType: string
                size: number
                path: string
                projectPath: string
                url: string
              }>) || undefined,
              createdAt: new Date().toISOString(),
            }
            return {
              ...old,
              messages: [...(old.messages || []), newMessage],
            }
          })
          break
        }

        case 'condition_retry':
          setStepStatus(data.stepId as string, 'retry')
          break

        case 'condition_jump':
          resetStreamingContent()
          break

        case 'dag_batch_start':
          setStreamingPhase('ai_thinking')
          resetStreamingContent()
          break

        case 'step_blocked':
          setStepStatus(data.stepId as string, 'blocked' as 'pending')
          break

        case 'validation_failed':
          addStreamingAction({
            type: 'system',
            content: `Validacao falhou: ${(data.error as string) || 'Erro de validacao no step'}`,
          })
          break

        case 'execution_paused':
          // Execution is waiting for user input — show input and question
          setStepStatus(data.stepId as string, 'paused')
          setPaused(true, {
            executionId: data.executionId as string,
            stepId: data.stepId as string,
            stepName: data.stepName as string,
            stepOrder: data.stepOrder as number,
            resumeToken: data.resumeToken as string | null,
            askUserQuestion: data.askUserQuestion as { question: string; options?: Array<{ label: string; description?: string }> } | undefined,
          })
          break

        case 'execution_resumed':
          // Execution resumed from paused state
          setPaused(false)
          setStepStatus(data.stepId as string, 'running')
          setStreamingPhase('ai_thinking')
          firstContentReceivedRef.current = false
          break

        case 'user_interrupt':
          // User sent a message mid-execution, Claude is incorporating it
          setInterrupting(false)
          resetStreamingContent()
          setStreamingPhase('ai_thinking')
          firstContentReceivedRef.current = false
          break

        case 'error':
          onError?.(data.message as string)
          break

        case 'complete':
          setPaused(false)
          onComplete?.()
          break
      }
    },
    [conversationId, queryClient, setProgress, setStepStatus, setStreamingPhase, appendStreamingContent, addStreamingAction, resetStreamingContent, setPaused, onError, onComplete]
  )

  const interruptExecution = useCallback(async (message: string) => {
    if (!isStreaming) return

    setInterrupting(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const token = localStorage.getItem('token')
      await fetch(`${apiUrl}/conversations/${conversationId}/interrupt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: message }),
      })
    } catch {
      setInterrupting(false)
    }
  }, [conversationId, isStreaming, setInterrupting])

  // Watch an active execution (reconnect after F5 or new tab)
  const watchRef = useRef<AbortController | null>(null)
  const isWatchingRef = useRef(false)

  const watchExecution = useCallback(async () => {
    if (isWatchingRef.current) return
    isWatchingRef.current = true

    clearStreaming()
    setStreaming(true)
    setStreamingPhase('streaming')
    firstContentReceivedRef.current = true

    watchRef.current = new AbortController()

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${apiUrl}/conversations/${conversationId}/watch`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: watchRef.current.signal,
        }
      )

      if (!response.ok) {
        setStreaming(false)
        isWatchingRef.current = false
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) { setStreaming(false); isWatchingRef.current = false; return }

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
              if (currentEvent === 'no_active_execution') {
                // No execution running, stop watching
                setStreaming(false)
                isWatchingRef.current = false
                return
              }
              handleEvent(currentEvent, data)
            } catch { /* ignore */ }
          }
        }
      }

      onComplete?.()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        // Silently fail — watch is optional
      }
    } finally {
      try {
        await queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
      } catch { /* ignore */ }
      setStreaming(false)
      isWatchingRef.current = false
    }
  }, [conversationId, queryClient, onComplete, handleEvent, clearStreaming, setStreaming, setStreamingPhase])

  // Auto-reconnect: check for active execution on mount
  useEffect(() => {
    const checkAndReconnect = async () => {
      const { isStreaming: alreadyStreaming } = useConversationsStore.getState()
      if (alreadyStreaming) return

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
        const token = localStorage.getItem('token')
        const res = await fetch(`${apiUrl}/conversations/${conversationId}/execution-status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) return
        const status = await res.json()

        if (status.active && status.state === 'running') {
          watchExecution()
        } else if (status.active && status.state === 'paused' && status.pausedInfo) {
          setPaused(true, {
            executionId: status.pausedInfo.executionId,
            stepId: status.pausedInfo.stepId,
            stepName: '',
            stepOrder: (status.stepIndex ?? 0) + 1,
            resumeToken: status.pausedInfo.resumeToken,
            askUserQuestion: status.pausedInfo.askUserQuestion,
          })
        }
      } catch { /* ignore */ }
    }

    checkAndReconnect()

    return () => {
      watchRef.current?.abort()
    }
  }, [conversationId, watchExecution, setPaused])

  const cancel = useCallback(async () => {
    // 1. Mark as cancelled immediately so UI stops
    cancelledRef.current = true
    setStreaming(false)

    // 2. Abort the HTTP connection — this also triggers the backend's
    //    'close' handler which will kill the process
    abortControllerRef.current?.abort()
    watchRef.current?.abort()
    isWatchingRef.current = false

    // 3. Update step statuses in UI
    const { stepStatuses, setStepStatus: updateStepStatus } = useConversationsStore.getState()
    stepStatuses.forEach((status, id) => {
      if (status === 'running') {
        updateStepStatus(id, 'cancelled')
      }
    })

    // 4. Also explicitly call the cancel endpoint as a safety net
    //    (in case the SSE close event doesn't propagate)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const cancelToken = localStorage.getItem('token')
      await fetch(`${apiUrl}/conversations/${conversationId}/cancel`, {
        method: 'POST',
        headers: cancelToken ? { Authorization: `Bearer ${cancelToken}` } : {},
      })
    } catch {
      // Ignore cancel API errors
    }

    // 5. Refetch conversation to get latest state
    queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'detail'] })
  }, [conversationId, setStreaming, queryClient])

  return {
    sendMessage,
    cancel,
    interruptExecution,
    isStreaming,
    streamingPhase,
    streamingContent,
    streamingActions,
    isPaused,
    pausedInfo,
  }
}
