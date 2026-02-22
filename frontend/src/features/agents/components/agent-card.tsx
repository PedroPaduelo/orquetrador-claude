import { Bot, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, Github, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Agent } from '../types'

interface AgentCardProps {
  agent: Agent
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onResync?: () => void
  isResyncing?: boolean
}

export function AgentCard({ agent, onEdit, onDelete, onToggle, onResync, isResyncing }: AgentCardProps) {
  const hasGitHub = agent.source === 'imported' && agent.repoOwner && agent.repoName

  return (
    <Card className={!agent.enabled ? 'opacity-60' : ''}>
      <div className="h-0.5 bg-gradient-to-r from-blue-500/60 via-blue-500/20 to-transparent" />
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
              {hasGitHub && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onResync} disabled={isResyncing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isResyncing ? 'animate-spin' : ''}`} />
                    {isResyncing ? 'Sincronizando...' : 'Resincronizar'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(agent.repoUrl || `https://github.com/${agent.repoOwner}/${agent.repoName}`, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver no GitHub
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
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
          {hasGitHub && (
            <Badge variant="default" className="text-[10px] gap-1">
              <Github className="h-3 w-3" />
              {agent.repoOwner}/{agent.repoName}
            </Badge>
          )}
          {agent.source === 'imported' && !hasGitHub && <Badge variant="default" className="text-[10px]">Importado</Badge>}
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
        {agent.lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground">
            Sync: {new Date(agent.lastSyncedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
