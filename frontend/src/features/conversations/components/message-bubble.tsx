import {
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  Terminal,
  Brain,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  Sparkles,
  Clock,
} from 'lucide-react'
import { useState, memo, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn, formatRelativeTime } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { UserQuestionCard } from './user-question-card'
import type { Message, Action } from '../types'

interface MessageBubbleProps {
  message:
    | Message
    | {
        id: string
        role: 'assistant'
        content: string
        metadata?: { actions?: Action[] }
      }
  isStreaming?: boolean
  onSendAnswer?: (answer: string) => void
}

function extractUserQuestions(actions: Action[]): {
  questions: Action[]
  otherActions: Action[]
} {
  const questions: Action[] = []
  const otherActions: Action[] = []

  for (const action of actions) {
    if (
      action.type === 'tool_use' &&
      action.name === 'AskUserQuestion' &&
      action.input
    ) {
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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{copied ? 'Copiado!' : 'Copiar'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CodeBlockHeader({
  language,
  code,
}: {
  language: string
  code: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background/90 border border-border rounded-t-lg border-b-0">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {language || 'code'}
      </span>
      <CopyButton text={code} />
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-sm text-muted-foreground">Pensando</span>
      </div>
      <div className="thinking-dots flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>
    </div>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  onSendAnswer,
}: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isUser = message.role === 'user'
  const actions = (message.metadata?.actions || []) as Action[]

  const { questions, otherActions } = useMemo(
    () => extractUserQuestions(actions),
    [actions]
  )

  const hasTimestamp = 'createdAt' in message && message.createdAt

  // Count action types for summary
  const actionSummary = useMemo(() => {
    const tools = otherActions.filter((a) => a.type === 'tool_use').length
    const thinking = otherActions.filter((a) => a.type === 'thinking').length
    const errors = otherActions.filter((a) => a.type === 'error').length
    return { tools, thinking, errors }
  }, [otherActions])

  return (
    <div
      className={cn(
        'group flex gap-3 transition-all',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all mt-0.5',
          isUser
            ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20'
            : 'bg-gradient-to-br from-muted to-card border border-border/50 shadow-sm'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn('flex flex-col gap-1.5 max-w-[85%]', isUser && 'items-end')}
      >
        {/* Header: role label + step badge + timestamp */}
        <div
          className={cn(
            'flex items-center gap-2 text-[11px]',
            isUser && 'flex-row-reverse'
          )}
        >
          <span className="font-medium text-muted-foreground">
            {isUser ? 'Você' : 'Claude'}
          </span>

          {'stepName' in message && message.stepName && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 border-primary/20 text-primary/80"
            >
              {message.stepName}
            </Badge>
          )}

          {hasTimestamp && (
            <span className="text-muted-foreground/50 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime((message as Message).createdAt)}
            </span>
          )}
        </div>

        {/* Message content */}
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border/60 rounded-tl-sm',
            isStreaming && !isUser && 'streaming-shimmer'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : message.content ? (
            <div
              className="prose prose-sm prose-invert max-w-none break-words
              prose-p:my-1.5 prose-headings:my-3 prose-headings:font-semibold
              prose-ul:my-1.5 prose-ol:my-1.5
              prose-li:my-0.5 prose-pre:my-2 prose-code:text-teal-300
              prose-pre:bg-background/60 prose-pre:border prose-pre:border-border
              prose-a:text-teal-400 prose-strong:text-foreground
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children, ...props }) {
                    // Extract language and code from children
                    const codeElement = children as React.ReactElement
                    const codeProps = codeElement?.props || {}
                    const className = codeProps.className || ''
                    const language = className.replace('language-', '')
                    const codeText =
                      typeof codeProps.children === 'string'
                        ? codeProps.children
                        : ''

                    return (
                      <div className="code-block-wrapper my-3">
                        <CodeBlockHeader
                          language={language}
                          code={codeText}
                        />
                        <pre
                          {...props}
                          className="!mt-0 !rounded-t-none !border-t-0"
                        >
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
          ) : (
            <ThinkingIndicator />
          )}

          {isStreaming && message.content && (
            <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5 rounded-full align-middle" />
          )}

          {/* Copy button for assistant messages - appears on hover */}
          {!isUser && !isStreaming && message.content && hovered && (
            <div className="absolute -top-2 -right-2 animate-fade-in">
              <CopyButton text={message.content} />
            </div>
          )}
        </div>

        {/* AskUserQuestion - Interactive question cards */}
        {!isUser && questions.length > 0 && onSendAnswer && (
          <div className="w-full space-y-2 mt-1">
            {questions.map((q, i) => {
              const input = q.input as {
                questions?: Array<{
                  question: string
                  header?: string
                  options: Array<{ label: string; description?: string }>
                  multiSelect?: boolean
                }>
              }
              if (!input?.questions) return null

              return (
                <UserQuestionCard
                  key={i}
                  questions={input.questions}
                  onAnswer={onSendAnswer}
                  disabled={isStreaming}
                />
              )
            })}
          </div>
        )}

        {/* Actions log - chain of thought style */}
        {!isUser && otherActions.length > 0 && (
          <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 h-7 px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all group/actions">
                {actionsOpen ? (
                  <ChevronDown className="h-3 w-3 transition-transform" />
                ) : (
                  <ChevronRight className="h-3 w-3 transition-transform" />
                )}
                <span className="flex items-center gap-1.5">
                  {actionSummary.tools > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Terminal className="h-3 w-3" />
                      {actionSummary.tools}
                    </span>
                  )}
                  {actionSummary.thinking > 0 && (
                    <span className="flex items-center gap-0.5">
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
                  {actionSummary.tools === 0 &&
                    actionSummary.thinking === 0 &&
                    actionSummary.errors === 0 && (
                      <span>
                        {otherActions.length}{' '}
                        {otherActions.length === 1 ? 'ação' : 'ações'}
                      </span>
                    )}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5 ml-1 border-l-2 border-border/40 pl-3 space-y-1.5">
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

const ActionItem = memo(function ActionItem({
  action,
}: {
  action: Action
}) {
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
      return typeof action.output === 'string'
        ? action.output
        : JSON.stringify(action.output, null, 2)
    }
    if (action.content) {
      return action.content
    }
    return null
  }

  const content = getActionContent()

  return (
    <div className={cn('rounded-lg border p-2', config.bgColor)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left transition-colors text-xs',
          config.color
        )}
      >
        {config.icon}
        <span className="font-medium">{config.label}</span>
        {content && (
          <span className="ml-auto">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </button>
      {expanded && content && (
        <div className="relative mt-2">
          <pre className="p-2.5 bg-background/60 rounded-md text-[11px] overflow-x-auto max-h-48 overflow-y-auto border border-border/20 text-muted-foreground">
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
