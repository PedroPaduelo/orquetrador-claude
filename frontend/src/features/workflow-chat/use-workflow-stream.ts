import { useCallback, useRef, useState } from 'react'
import type { WorkflowSummary } from './api'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  stepName?: string
  timestamp: Date
  isStreaming?: boolean
}

interface UseWorkflowStreamOptions {
  onError?: (error: string) => void
}

export function useWorkflowStream(options?: UseWorkflowStreamOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'thinking' | 'streaming'>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const firstContentRef = useRef(false)

  const sendMessage = useCallback(
    async (
      content: string,
      workflow: WorkflowSummary,
      projectPath: string,
    ) => {
      if (isStreaming) return

      // Add user message
      const userMsg: AgentMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      setIsStreaming(true)
      setStreamingContent('')
      setCurrentStep(null)
      setPhase('connecting')
      firstContentRef.current = false

      abortRef.current = new AbortController()

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const token = localStorage.getItem('token')

      const finalUrl = `${apiUrl}/api/v1/workflows/${workflow.id}/execute/stream`
      let accumulated = ''

      try {
        const response = await fetch(finalUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: content,
            projectPath,
            ...(conversationId ? { conversationId } : {}),
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status}`
          try {
            const err = await response.json()
            errorMsg = err.message || errorMsg
          } catch { /* ignore */ }
          throw new Error(errorMsg)
        }

        setPhase('thinking')

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No reader')

        let buffer = ''
        let currentEvent = ''
        let lastStepName: string | undefined

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(5).trim())

                switch (currentEvent) {
                  case 'init':
                    setConversationId(data.conversationId)
                    break

                  case 'step_start':
                    setCurrentStep(data.stepName)
                    lastStepName = data.stepName
                    // If there was accumulated content from a previous step, save it
                    if (accumulated.trim()) {
                      const stepMsg: AgentMessage = {
                        id: `assistant-${Date.now()}-${data.stepOrder}`,
                        role: 'assistant',
                        content: accumulated,
                        stepName: lastStepName,
                        timestamp: new Date(),
                      }
                      setMessages((prev) => [...prev, stepMsg])
                      accumulated = ''
                      setStreamingContent('')
                    }
                    setPhase('thinking')
                    firstContentRef.current = false
                    break

                  case 'stream':
                    if (data.type === 'content' && data.content) {
                      if (!firstContentRef.current) {
                        firstContentRef.current = true
                        setPhase('streaming')
                      }
                      accumulated += data.content
                      setStreamingContent(accumulated)
                    }
                    break

                  case 'step_complete':
                    lastStepName = data.stepName
                    break

                  case 'step_error':
                    options?.onError?.(data.error)
                    break

                  case 'error':
                    options?.onError?.(data.message)
                    break

                  case 'complete':
                    // Save final accumulated content
                    if (accumulated.trim()) {
                      const finalMsg: AgentMessage = {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: accumulated,
                        stepName: lastStepName,
                        timestamp: new Date(),
                      }
                      setMessages((prev) => [...prev, finalMsg])
                    }
                    break
                }
              } catch { /* ignore parse errors */ }
              currentEvent = ''
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          options?.onError?.((error as Error).message)
          // Save whatever we accumulated so far
          if (accumulated.trim()) {
            const partialMsg: AgentMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, partialMsg])
          }
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        setPhase('idle')
        setCurrentStep(null)
      }
    },
    [isStreaming, conversationId, options],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setPhase('idle')

    if (conversationId) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const token = localStorage.getItem('token')
      fetch(`${apiUrl}/api/v1/executions/${conversationId}/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {})
    }
  }, [conversationId])

  const reset = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setStreamingContent('')
    setIsStreaming(false)
    setPhase('idle')
    setCurrentStep(null)
  }, [])

  return {
    messages,
    isStreaming,
    streamingContent,
    currentStep,
    conversationId,
    phase,
    sendMessage,
    cancel,
    reset,
  }
}
