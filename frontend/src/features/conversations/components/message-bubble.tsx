import { User, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import type { Message, Action } from '../types'

interface MessageBubbleProps {
  message: Message | { id: string; role: 'assistant'; content: string; metadata?: { actions?: Action[] } }
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const isUser = message.role === 'user'
  const actions = (message.metadata?.actions || []) as Action[]

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        {/* Step badge */}
        {'stepName' in message && message.stepName && (
          <Badge variant="outline" className="text-xs w-fit">
            {message.stepName}
          </Badge>
        )}

        {/* Message content */}
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
            isStreaming && 'animate-pulse'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {isStreaming && <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />}
        </div>

        {/* Actions log */}
        {!isUser && actions.length > 0 && (
          <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                {actionsOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                {actions.length} acoes
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1 text-xs">
                {actions.map((action, i) => (
                  <ActionItem key={i} action={action} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

function ActionItem({ action }: { action: Action }) {
  const [expanded, setExpanded] = useState(false)

  const getActionLabel = () => {
    switch (action.type) {
      case 'tool_use':
        return `Tool: ${action.name}`
      case 'tool_result':
        return `Result: ${action.name}`
      case 'thinking':
        return 'Thinking'
      case 'error':
        return 'Error'
      case 'stderr':
        return 'Stderr'
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
    <div className="border rounded p-2 bg-background">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">{getActionLabel()}</span>
      </button>
      {expanded && content && (
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
          {content.slice(0, 5000)}
          {content.length > 5000 && '... (truncated)'}
        </pre>
      )}
    </div>
  )
}
