import { useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Zap, Send } from 'lucide-react'
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
          toast.success('Execução concluída!')
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
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Pronto para começar</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {steps.length > 0
                ? `Envie uma mensagem para iniciar o step "${steps[currentStepIndex]?.name || 'atual'}". O Claude vai processar cada etapa do workflow.`
                : 'Envie uma mensagem para iniciar a conversa com o Claude.'
              }
            </p>
            <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Send className="h-3 w-3" />
              <span>Enter para enviar, Shift+Enter para nova linha</span>
            </div>
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
