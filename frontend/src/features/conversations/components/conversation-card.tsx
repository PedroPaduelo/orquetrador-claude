import { MoreHorizontal, Trash2, MessageSquare, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
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
}

export function ConversationCard({ conversation, onDelete }: ConversationCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/conversations/${conversation.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            {conversation.title || 'Sem titulo'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {conversation.workflowName}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Badge variant={conversation.workflowType === 'sequential' ? 'default' : 'secondary'}>
            {conversation.workflowType === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
          </Badge>

          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{conversation.messagesCount || 0} msgs</span>
          </div>

          {conversation.currentStepName && (
            <div className="flex items-center gap-1">
              <ArrowRight className="h-4 w-4" />
              <span>{truncate(conversation.currentStepName, 20)}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          {formatDate(conversation.updatedAt)}
        </p>
      </CardContent>
    </Card>
  )
}
