import React from 'react'
import { MoreHorizontal, Trash2, Copy, MessageSquare, ArrowRight, Clock, Circle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { formatDate, truncate } from '@/shared/lib/utils'
import type { Conversation } from '../types'

interface ConversationCardProps {
  conversation: Conversation
  onDelete: () => void
  onClone: () => void
}

export function ConversationCard({ conversation, onDelete, onClone }: ConversationCardProps) {
  const navigate = useNavigate()

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(`/conversations/${conversation.id}`, '_blank')
    } else {
      navigate(`/conversations/${conversation.id}`)
    }
  }

  return (
    <Card
      className="group hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 cursor-pointer overflow-hidden"
      onClick={handleClick}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
              {conversation.title || 'Sem título'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {conversation.workflowName}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onClone()
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Clonar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={
              conversation.workflowType === 'sequential'
                ? 'border-primary/30 text-primary bg-primary/5'
                : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
            }
          >
            {conversation.workflowType === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
          </Badge>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{conversation.messagesCount || 0} msgs</span>
          </div>

          {conversation.currentStepName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="truncate max-w-[100px]">{truncate(conversation.currentStepName, 20)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            {'status' in conversation && conversation.status === 'running' && (
              <span className="flex items-center gap-1 text-[11px] text-amber-500">
                <Circle className="h-2 w-2 fill-amber-500" />
                Executando
              </span>
            )}
            {'status' in conversation && conversation.status === 'completed' && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                <Circle className="h-2 w-2 fill-emerald-500" />
                Concluído
              </span>
            )}
            {'status' in conversation && conversation.status === 'failed' && (
              <span className="flex items-center gap-1 text-[11px] text-destructive">
                <Circle className="h-2 w-2 fill-destructive" />
                Erro
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(conversation.updatedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
