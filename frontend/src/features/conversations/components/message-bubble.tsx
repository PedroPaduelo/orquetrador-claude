import { User, Bot, ChevronDown, ChevronRight, Terminal, Brain, AlertTriangle, FileCode, Copy, Check } from 'lucide-react'
import { useState, memo, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { UserQuestionCard } from './user-question-card'
import type { Message, Action, Attachment } from '../types'
import type { StreamingPhase } from '../store'

interface MessageBubbleProps {
  message: Message | { id: string; role: 'assistant'; content: string; metadata?: { actions?: Action[] }; attachments?: Attachment[] }
  isStreaming?: boolean
  streamingPhase?: StreamingPhase
  onSendAnswer?: (answer: string) => void
  answeredText?: string
}

function extractUserQuestions(actions: Action[]): { questions: Action[]; otherActions: Action[] } {
  const questions: Action[] = []
  const otherActions: Action[] = []

  for (const action of actions) {
    if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
      questions.push(action)
    } else {
      otherActions.push(action)
    }
  }

  return { questions, otherActions }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
      title={copied ? 'Copiado!' : 'Copiar'}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  )
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, streamingPhase, onSendAnswer, answeredText }: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const isUser = message.role === 'user'
  const actions = (message.metadata?.actions || []) as Action[]

  const { questions, otherActions } = extractUserQuestions(actions)

  // Count action types for summary
  const actionSummary = useMemo(() => {
    const tools = otherActions.filter(a => a.type === 'tool_use').length
    const thinking = otherActions.filter(a => a.type === 'thinking').length
    const errors = otherActions.filter(a => a.type === 'error').length
    return { tools, thinking, errors }
  }, [otherActions])

  return (
    <div className={cn('group/msg flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-2 max-w-[85%]', isUser && 'items-end')}>
        {/* Step badge */}
        {'stepName' in message && message.stepName && (
          <Badge variant="outline" className="text-[10px] w-fit px-2 py-0 h-5 border-primary/20 text-primary">
            {message.stepName}
          </Badge>
        )}

        {/* Message content */}
        <div
          className={cn(
            'relative rounded-xl text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm px-4 py-3'
              : 'bg-muted/60 border border-border/50 rounded-bl-sm px-5 py-4',
          )}
        >
          {isUser ? (
            <>
              {/* Show attached images for user messages */}
              {'attachments' in message && message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.attachments.map((att) => {
                    const imgUrl = att.url.startsWith('http') ? att.url : `${import.meta.env.VITE_API_URL || 'http://localhost:3333'}${att.url}`
                    return (
                      <a
                        key={att.id}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={imgUrl}
                          alt={att.filename}
                          className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-primary-foreground/20"
                        />
                      </a>
                    )
                  })}
                </div>
              )}
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </>
          ) : message.content ? (
            <div className="prose prose-invert max-w-none break-words
              prose-p:my-2.5 prose-p:leading-relaxed
              prose-headings:mt-5 prose-headings:mb-2.5 prose-headings:first:mt-0
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h3:font-semibold
              prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-li:leading-relaxed
              prose-pre:my-3 prose-code:text-teal-300
              prose-pre:bg-background/50 prose-pre:border prose-pre:border-border
              prose-a:text-teal-400 prose-strong:text-foreground
              prose-blockquote:my-3 prose-hr:my-4
              text-[14px] leading-[1.7]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children, ...props }) {
                    const codeElement = children as React.ReactElement
                    const codeProps = codeElement?.props || {}
                    const className = codeProps.className || ''
                    const lang = className.replace('language-', '')
                    const codeText = typeof codeProps.children === 'string' ? codeProps.children : ''

                    return (
                      <div className="code-block-wrapper my-3">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-background/90 border border-border rounded-t-lg border-b-0">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {lang || 'code'}
                          </span>
                          <CopyButton text={codeText} />
                        </div>
                        <pre {...props} className="!mt-0 !rounded-t-none !border-t-0">
                          {children}
                        </pre>
                      </div>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground">
                {streamingPhase === 'preparing' && 'Enviando...'}
                {streamingPhase === 'connecting' && 'Conectando...'}
                {streamingPhase === 'ai_thinking' && 'IA pensando...'}
                {streamingPhase === 'streaming' && 'Gerando resposta...'}
                {(!streamingPhase || streamingPhase === 'idle') && ''}
              </span>
              <span className="thinking-dots flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
            </div>
          ) : null}
          {isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
          )}

          {/* Copy message button - appears on hover, absolute so no layout shift */}
          {!isUser && !isStreaming && message.content && (
            <div className="absolute -top-3 -right-3 opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <div className="bg-card border border-border rounded-md shadow-sm">
                <CopyButton text={message.content} />
              </div>
            </div>
          )}
        </div>

        {/* AskUserQuestion - Interactive question cards */}
        {!isUser && questions.length > 0 && (
          <div className="w-full space-y-2">
            {questions.map((q, i) => {
              const input = q.input as { questions?: Array<{ question: string; header?: string; options: Array<{ label: string; description?: string }>; multiSelect?: boolean }> }
              if (!input?.questions) return null

              return (
                <UserQuestionCard
                  key={i}
                  questions={input.questions}
                  onAnswer={onSendAnswer || (() => {})}
                  disabled={isStreaming || !!answeredText}
                  answeredText={answeredText}
                />
              )
            })}
          </div>
        )}

        {/* Actions log - improved chain-of-thought style */}
        {!isUser && otherActions.length > 0 && (
          <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                {actionsOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1.5" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1.5" />
                )}
                <span className="flex items-center gap-2">
                  {actionSummary.tools > 0 && (
                    <span className="flex items-center gap-0.5 text-info">
                      <Terminal className="h-3 w-3" />
                      {actionSummary.tools}
                    </span>
                  )}
                  {actionSummary.thinking > 0 && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <Brain className="h-3 w-3" />
                      {actionSummary.thinking}
                    </span>
                  )}
                  {actionSummary.errors > 0 && (
                    <span className="flex items-center gap-0.5 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {actionSummary.errors}
                    </span>
                  )}
                  {actionSummary.tools === 0 && actionSummary.thinking === 0 && actionSummary.errors === 0 && (
                    <span>{otherActions.length} {otherActions.length === 1 ? 'ação' : 'ações'}</span>
                  )}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5 ml-1 border-l-2 border-border/40 pl-3 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {otherActions.map((action, i) => (
                  <ActionItem key={i} action={action} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
})

const ActionItem = memo(function ActionItem({ action }: { action: Action }) {
  const [expanded, setExpanded] = useState(false)

  const getActionConfig = () => {
    switch (action.type) {
      case 'tool_use':
        return {
          icon: <Terminal className="h-3 w-3" />,
          label: action.name || 'Tool',
          color: 'text-info',
          bgColor: 'bg-info/5 border-info/10',
        }
      case 'tool_result':
        return {
          icon: <FileCode className="h-3 w-3" />,
          label: action.name || 'Result',
          color: 'text-success',
          bgColor: 'bg-success/5 border-success/10',
        }
      case 'thinking':
        return {
          icon: <Brain className="h-3 w-3" />,
          label: 'Pensamento',
          color: 'text-primary',
          bgColor: 'bg-primary/5 border-primary/10',
        }
      case 'error':
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          label: 'Erro',
          color: 'text-destructive',
          bgColor: 'bg-destructive/5 border-destructive/10',
        }
      case 'stderr':
        return {
          icon: <Terminal className="h-3 w-3" />,
          label: 'Log',
          color: 'text-warning',
          bgColor: 'bg-warning/5 border-warning/10',
        }
      default:
        return {
          icon: <Terminal className="h-3 w-3" />,
          label: action.type,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/30 border-border/30',
        }
    }
  }

  const config = getActionConfig()

  const getActionContent = () => {
    if (action.type === 'tool_use' && action.input) {
      return JSON.stringify(action.input, null, 2)
    }
    if (action.type === 'tool_result' && action.output) {
      return typeof action.output === 'string' ? action.output : JSON.stringify(action.output, null, 2)
    }
    if (action.content) {
      return action.content
    }
    return null
  }

  const content = getActionContent()

  return (
    <div className={cn('rounded-lg border p-2.5', config.bgColor)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left transition-colors text-xs',
          config.color
        )}
      >
        {config.icon}
        <span className="font-medium">{config.label}</span>
        {content && (
          <span className="ml-auto">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>
      {expanded && content && (
        <div className="relative mt-2">
          <pre className="p-2.5 bg-background/80 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto border border-border/30">
            {content.slice(0, 5000)}
            {content.length > 5000 && '\n... (truncado)'}
          </pre>
          <div className="absolute top-1 right-1">
            <CopyButton text={content} />
          </div>
        </div>
      )}
    </div>
  )
})
