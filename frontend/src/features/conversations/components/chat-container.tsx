import { useRef, useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Zap, Send, ArrowDown, MessageSquare } from 'lucide-react'

function playCompletionSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    // Nota 1
    const o1 = ctx.createOscillator()
    const g1 = ctx.createGain()
    o1.type = 'sine'
    o1.frequency.value = 523.25 // C5
    g1.gain.setValueAtTime(0.3, now)
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    o1.connect(g1).connect(ctx.destination)
    o1.start(now)
    o1.stop(now + 0.15)

    // Nota 2
    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.type = 'sine'
    o2.frequency.value = 659.25 // E5
    g2.gain.setValueAtTime(0.3, now + 0.15)
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    o2.connect(g2).connect(ctx.destination)
    o2.start(now + 0.15)
    o2.stop(now + 0.3)

    // Nota 3
    const o3 = ctx.createOscillator()
    const g3 = ctx.createGain()
    o3.type = 'sine'
    o3.frequency.value = 783.99 // G5
    g3.gain.setValueAtTime(0.3, now + 0.3)
    g3.gain.exponentialRampToValueAtTime(0.01, now + 0.55)
    o3.connect(g3).connect(ctx.destination)
    o3.start(now + 0.3)
    o3.stop(now + 0.55)

    setTimeout(() => ctx.close(), 1000)
  } catch { /* audio not available */ }
}
import { Button } from '@/shared/components/ui/button'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { StreamingStatus } from './streaming-status'
import { SuggestedNextSteps } from './suggested-next-steps'
import { useSSEStream } from '../hooks/use-sse-stream'
import { useConversationsStore } from '../store'
import type { Conversation, Action } from '../types'

interface ChatContainerProps {
  conversation: Conversation
}

const SUGGESTED_PROMPTS = [
  'Analise a estrutura do projeto',
  'Documente os arquivos principais',
  'Identifique bugs potenciais',
  'Sugira melhorias de performance',
]

export function ChatContainer({ conversation }: ChatContainerProps) {
  const chatRef = useRef<HTMLDivElement>(null)
  const { initStepStatuses } = useConversationsStore()
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  const steps = conversation.workflow?.steps || []
  const messages = conversation.messages || []
  const currentStepIndex = conversation.currentStepIndex || 0

  const { sendMessage, cancel, interruptExecution, isStreaming, streamingPhase, streamingContent, streamingActions, isPaused, pausedInfo } =
    useSSEStream({
      conversationId: conversation.id,
      onComplete: () => {
        playCompletionSound()
        setShowSuggestions(true) // Show suggestions after execution completes
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
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, streamingContent])

  // Track scroll position for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!chatRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200)
  }, [])

  const scrollToBottom = useCallback(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [])

  const isWorkflowFinished =
    conversation.workflow?.type === 'step_by_step' && currentStepIndex >= steps.length

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages */}
      <div ref={chatRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
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

            {/* Suggested prompts */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt, currentStepIndex)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          // Check if this assistant message's questions have been answered
          // by looking for a subsequent user message
          let answeredText: string | undefined
          if (message.role === 'assistant') {
            const actions = (message.metadata?.actions || []) as Action[]
            const hasQuestions = actions.some(
              (a) => a.type === 'tool_use' && a.name === 'AskUserQuestion'
            )
            if (hasQuestions) {
              const nextMessage = messages[index + 1]
              if (nextMessage && nextMessage.role === 'user') {
                answeredText = nextMessage.content
              }
            }
          }

          return (
            <MessageBubble
              key={message.id}
              message={message}
              onSendAnswer={!isStreaming && !answeredText ? handleSendAnswer : undefined}
              answeredText={answeredText}
            />
          )
        })}

        {/* Streaming message - show even without content for thinking indicator */}
        {/* Don't show if the last DB message already has matching content (avoids duplicate during refetch transition) */}
        {isStreaming && (() => {
          const lastMsg = messages[messages.length - 1]
          const isDuplicate = lastMsg?.role === 'assistant' && lastMsg.content === streamingContent && streamingContent.length > 0
          if (isDuplicate) return null
          return (
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                metadata: { actions: streamingActions },
              }}
              isStreaming
              streamingPhase={streamingPhase}
            />
          )
        })()}
      </div>

      {/* Scroll to bottom - absolute, no layout impact */}
      {showScrollBtn && (
        <Button
          size="sm"
          variant="secondary"
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 rounded-full shadow-lg z-10 h-8 w-8 p-0"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      {/* Streaming status bar */}
      <StreamingStatus
        isStreaming={isStreaming}
        phase={streamingPhase}
        onCancel={cancel}
      />

      {/* Paused indicator - Claude is waiting for user input */}
      {isPaused && pausedInfo?.askUserQuestion && (
        <div className="border-t border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-amber-500">
                Aguardando resposta — Step {pausedInfo.stepOrder}: {pausedInfo.stepName}
              </span>
            </div>
            <p className="text-sm text-foreground/80 mb-2">{pausedInfo.askUserQuestion.question}</p>
            {pausedInfo.askUserQuestion.options && pausedInfo.askUserQuestion.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pausedInfo.askUserQuestion.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => sendMessage(opt.label, currentStepIndex)}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-sm text-foreground transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {showSuggestions && !isStreaming && !isWorkflowFinished && messages.length > 0 && (
        <SuggestedNextSteps
          key={`suggestions-${messages.length}`}
          conversationId={conversation.id}
          onSelect={(text) => {
            setShowSuggestions(false)
            sendMessage(text, currentStepIndex)
          }}
        />
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversation.id}
        onSend={(content, attachments) => {
          setShowSuggestions(false)
          sendMessage(content, currentStepIndex, attachments)
        }}
        onCancel={cancel}
        onInterrupt={interruptExecution}
        isStreaming={isStreaming}
        isPaused={isPaused}
        disabled={isWorkflowFinished}
      />
    </div>
  )
}
