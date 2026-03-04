import { MoreVertical, Trash2, ArrowRight, MessageSquare, Circle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

interface ConversationTableProps {
  conversations: Conversation[]
  onDelete: (conversation: Conversation) => void
}

export function ConversationTable({ conversations, onDelete }: ConversationTableProps) {
  const navigate = useNavigate()

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Tipo</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Msgs</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Step Atual</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Atualizado</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((conv, index) => {
            const status = 'status' in conv ? (conv as any).status : undefined
            return (
              <tr
                key={conv.id}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up cursor-pointer"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    window.open(`/conversations/${conv.id}`, '_blank')
                  } else {
                    navigate(`/conversations/${conv.id}`)
                  }
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {status === 'running' && <Circle className="h-2 w-2 fill-amber-500 text-amber-500 shrink-0" />}
                    {status === 'completed' && <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />}
                    {status === 'failed' && <Circle className="h-2 w-2 fill-destructive text-destructive shrink-0" />}
                    <span className="font-medium truncate block max-w-[250px]">
                      {conv.title || 'Sem título'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                    {conv.workflowName || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Badge
                    variant="outline"
                    className={
                      conv.workflowType === 'sequential'
                        ? 'border-primary/30 text-primary bg-primary/5 text-[10px]'
                        : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px]'
                    }
                  >
                    {conv.workflowType === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{conv.messagesCount || 0}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {conv.currentStepName ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[120px]">{truncate(conv.currentStepName, 20)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/conversations/${conv.id}`) }}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDelete(conv) }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
