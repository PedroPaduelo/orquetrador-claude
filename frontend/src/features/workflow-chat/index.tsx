import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  Send,
  Square,
  ChevronDown,
  RotateCcw,
  Zap,
  FolderOpen,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { workflowChatApi, type WorkflowSummary } from './api'
import { useWorkflowStream, type AgentMessage } from './use-workflow-stream'
import { toast } from 'sonner'

// ─── Folder selector hook ────────────────────────────────────────────

function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const { apiClient } = await import('@/shared/lib/api-client')
      const res = await apiClient.get<Array<{ name: string; path: string }>>('/folders')
      return res.data
    },
  })
}

// ─── Code block with copy button ─────────────────────────────────────

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') || ''

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-3 border border-border/50 bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-border/30">
        <span className="text-[10px] font-mono text-zinc-500 uppercase">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-sm">
        <code className={cn('text-zinc-200', className)}>{children}</code>
      </pre>
    </div>
  )
}

// ─── Message component ───────────────────────────────────────────────

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 animate-fade-in-up', isUser ? 'flex-row-reverse' : '')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser
            ? 'bg-primary/10 text-primary'
            : 'bg-gradient-to-br from-violet-500/20 to-teal-500/20 text-violet-400',
        )}
      >
        {isUser ? (
          <span className="text-xs font-bold">U</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={cn('max-w-[80%] min-w-0', isUser ? 'text-right' : '')}>
        {message.stepName && !isUser && (
          <span className="text-[10px] text-muted-foreground/60 font-mono mb-1 block">
            {message.stepName}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted/50 border border-border/50 rounded-bl-md',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-0 prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="bg-zinc-800/50 text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                          {children}
                        </code>
                      )
                    }
                    return <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Streaming indicator ─────────────────────────────────────────────

function StreamingBubble({
  content,
  phase,
  currentStep,
}: {
  content: string
  phase: string
  currentStep: string | null
}) {
  const phaseLabels: Record<string, string> = {
    connecting: 'Conectando...',
    thinking: 'Pensando...',
    streaming: currentStep || 'Respondendo...',
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gradient-to-br from-violet-500/20 to-teal-500/20 text-violet-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] min-w-0">
        <span className="text-[10px] text-muted-foreground/60 font-mono mb-1 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          {phaseLabels[phase] || 'Processando...'}
        </span>
        <div className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-muted/50 border border-border/50">
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-0 prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="bg-zinc-800/50 text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                          {children}
                        </code>
                      )
                    }
                    return <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="thinking-dots">
                <span /><span /><span />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────

export default function WorkflowChatPage() {
  const { data: workflows, isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflow-chat-list'],
    queryFn: workflowChatApi.listWorkflows,
  })
  const { data: folders } = useFolders()

  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowSummary | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [input, setInput] = useState('')

  const {
    messages,
    isStreaming,
    streamingContent,
    currentStep,
    conversationId,
    phase,
    sendMessage,
    cancel,
    reset,
  } = useWorkflowStream({
    onError: (error) => toast.error(error),
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Handle send
  const handleSend = () => {
    if (!input.trim() || !selectedWorkflow || !selectedFolder || isStreaming) return
    sendMessage(input.trim(), selectedWorkflow, selectedFolder)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    reset()
    setInput('')
  }

  const hasMessages = messages.length > 0 || isStreaming
  const canSend = input.trim() && selectedWorkflow && selectedFolder && !isStreaming

  // ─── Empty state (workflow + folder selection) ──────────────────

  if (!hasMessages) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 page-enter">
        <div className="w-full max-w-xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-teal-500/20 flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Workflow Agent</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Selecione um workflow e um projeto. O workflow vai funcionar como um agente —
              voce manda mensagens e ele executa e responde.
            </p>
          </div>

          {/* Selectors */}
          <div className="space-y-4">
            {/* Workflow selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workflow (Agente)
              </label>
              {loadingWorkflows ? (
                <div className="h-12 rounded-lg bg-muted animate-pulse" />
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {workflows?.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWorkflow(w)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                        selectedWorkflow?.id === w.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'hover:bg-muted/50 hover:border-border',
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        selectedWorkflow?.id === w.id
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{w.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {w.stepsCount} step{w.stepsCount !== 1 ? 's' : ''}
                          {w.description ? ` · ${w.description}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Folder selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Projeto (Pasta)
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full h-11 rounded-lg border bg-background pl-10 pr-4 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Selecione um projeto...</option>
                  {folders?.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !selectedWorkflow
                  ? 'Selecione um workflow acima...'
                  : !selectedFolder
                  ? 'Selecione um projeto acima...'
                  : `Mensagem para ${selectedWorkflow.name}...`
              }
              disabled={!selectedWorkflow || !selectedFolder}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              rows={1}
            />
            <Button
              size="icon"
              disabled={!canSend}
              onClick={handleSend}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Chat view ──────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col page-enter">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-teal-500/20 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{selectedWorkflow?.name}</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {selectedFolder?.split('/').pop()}
              {conversationId && (
                <span className="ml-2 opacity-50">· {conversationId.slice(0, 8)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancel}
              className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Square className="h-3 w-3 mr-1.5 fill-current" />
              Parar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleNewChat} className="h-8 text-xs">
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Novo chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <StreamingBubble
            content={streamingContent}
            phase={phase}
            currentStep={currentStep}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full shadow-lg h-8 px-3 text-xs"
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Rolar para baixo
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Aguardando resposta...'
                : `Mensagem para ${selectedWorkflow?.name}...`
            }
            disabled={isStreaming}
            className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            rows={1}
          />
          <Button
            size="icon"
            disabled={!canSend}
            onClick={handleSend}
            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
