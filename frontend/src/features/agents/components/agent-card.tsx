import { Bot, MoreVertical, Trash2, Pencil, Power, PowerOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Agent } from '../types'

interface AgentCardProps {
  agent: Agent
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

export function AgentCard({ agent, onEdit, onDelete, onToggle }: AgentCardProps) {
  return (
    <Card className={!agent.enabled ? 'opacity-60' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium truncate">{agent.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                {agent.enabled ? (
                  <><PowerOff className="h-4 w-4 mr-2" />Desativar</>
                ) : (
                  <><Power className="h-4 w-4 mr-2" />Ativar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {agent.source === 'imported' && <Badge variant="default" className="text-[10px]">Importado</Badge>}
          {agent.model && <Badge variant="secondary">{agent.model}</Badge>}
          {agent.isGlobal && <Badge variant="outline">Global</Badge>}
          {agent.tools.length > 0 && (
            <Badge variant="outline">{agent.tools.length} ferramenta(s)</Badge>
          )}
        </div>
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
        )}
        <p className="text-xs text-muted-foreground/70 truncate">
          Modo: {agent.permissionMode}
          {agent.maxTurns && ` | Max turnos: ${agent.maxTurns}`}
        </p>
      </CardContent>
    </Card>
  )
}
