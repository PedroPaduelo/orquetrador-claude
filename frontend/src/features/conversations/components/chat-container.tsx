import { useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { MessageSquare } from 'lucide-react'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { useSSEStream } from '../hooks/use-sse-stream'
import { useConversationsStore } from '../store'
import type { Conversation } from '../types'

interface ChatContainerProps {
  conversation: Conversation
}

export function ChatContainer({ conversation }: ChatContainerProps) {
  const chatRef = useRef<HTMLDivElement>(null)
  const { initStepStatuses } = useConversationsStore()

  const steps = conversation.workflow?.steps || []
  const messages = conversation.messages || []
  const currentStepIndex = conversation.currentStepIndex || 0

  const { sendMessage, cancel, isStreaming, streamingContent, streamingActions } =
    useSSEStream({
      conversationId: conversation.id,
      onComplete: () => {
        if (conversation.workflow?.type === 'step_by_step') {
          // Don't show "execution complete" for step_by_step - the chat continues
        } else {
          toast.success('Execucao concluida!')
        }
      },
      onError: (error) => {
        toast.error(`Erro: ${error}`)
      },
    })

  // Handle answers from AskUserQuestion cards
  const handleSendAnswer = useCallback(
    (answer: string) => {
      sendMessage(answer, currentStepIndex)
    },
    [sendMessage, currentStepIndex]
  )

  // Initialize step statuses
  useEffect(() => {
    if (steps.length > 0) {
      initStepStatuses(steps)
    }
  }, [steps, initStepStatuses])

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  const isWorkflowFinished =
    conversation.workflow?.type === 'step_by_step' && currentStepIndex >= steps.length

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
            <p className="text-sm">Envie uma mensagem para comecar a conversa</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onSendAnswer={!isStreaming ? handleSendAnswer : undefined}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              metadata: { actions: streamingActions },
            }}
            isStreaming
          />
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={(content) => sendMessage(content, currentStepIndex)}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={isWorkflowFinished}
      />
    </div>
  )
}
