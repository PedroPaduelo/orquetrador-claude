import { User, Bot, ChevronDown, ChevronRight, Terminal, Brain, AlertTriangle, FileCode } from 'lucide-react'
import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { UserQuestionCard } from './user-question-card'
import type { Message, Action } from '../types'

interface MessageBubbleProps {
  message: Message | { id: string; role: 'assistant'; content: string; metadata?: { actions?: Action[] } }
  isStreaming?: boolean
  onSendAnswer?: (answer: string) => void
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

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, onSendAnswer }: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const isUser = message.role === 'user'
  const actions = (message.metadata?.actions || []) as Action[]

  const { questions, otherActions } = extractUserQuestions(actions)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
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
            'rounded-xl px-4 py-3 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted/60 border border-border/50 rounded-bl-sm',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none break-words
              prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5
              prose-li:my-0.5 prose-pre:my-2 prose-code:text-teal-300
              prose-pre:bg-background/50 prose-pre:border prose-pre:border-border
              prose-a:text-teal-400 prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
          )}
        </div>

        {/* AskUserQuestion - Interactive question cards */}
        {!isUser && questions.length > 0 && onSendAnswer && (
          <div className="w-full space-y-2">
            {questions.map((q, i) => {
              const input = q.input as { questions?: Array<{ question: string; header?: string; options: Array<{ label: string; description?: string }>; multiSelect?: boolean }> }
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

        {/* Actions log */}
        {!isUser && otherActions.length > 0 && (
          <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                {actionsOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                {otherActions.length} {otherActions.length === 1 ? 'ação' : 'ações'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1 text-xs">
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

  const getActionIcon = () => {
    switch (action.type) {
      case 'tool_use':
        return <Terminal className="h-3 w-3" />
      case 'tool_result':
        return <FileCode className="h-3 w-3" />
      case 'thinking':
        return <Brain className="h-3 w-3" />
      case 'error':
        return <AlertTriangle className="h-3 w-3 text-destructive" />
      default:
        return <Terminal className="h-3 w-3" />
    }
  }

  const getActionLabel = () => {
    switch (action.type) {
      case 'tool_use':
        return action.name || 'Tool'
      case 'tool_result':
        return `${action.name || 'Result'}`
      case 'thinking':
        return 'Pensando...'
      case 'error':
        return 'Erro'
      case 'stderr':
        return 'Log'
      default:
        return action.type
    }
  }

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
    <div className="border rounded-lg p-2.5 bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground w-full text-left transition-colors"
      >
        {getActionIcon()}
        <span className="font-medium">{getActionLabel()}</span>
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {expanded && content && (
        <pre className="mt-2 p-2.5 bg-background/80 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto border border-border/30">
          {content.slice(0, 5000)}
          {content.length > 5000 && '\n... (truncado)'}
        </pre>
      )}
    </div>
  )
})
