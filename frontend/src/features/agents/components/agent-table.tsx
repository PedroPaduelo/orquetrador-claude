import { Bot, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Agent } from '../types'

interface AgentTableProps {
  agents: Agent[]
  onEdit: (agent: Agent) => void
  onDelete: (agent: Agent) => void
  onToggle: (agent: Agent) => void
  onResync: (agent: Agent) => void
  isResyncing: boolean
}

export function AgentTable({ agents, onEdit, onDelete, onToggle, onResync, isResyncing }: AgentTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Model</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Modo</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Descrição</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, index) => {
            const hasGitHub = agent.source === 'imported' && agent.repoOwner && agent.repoName
            return (
              <tr
                key={agent.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up ${!agent.enabled ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium truncate block max-w-[200px]">{agent.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-muted-foreground">{agent.enabled ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {agent.model ? <Badge variant="secondary" className="text-[10px]">{agent.model}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">{agent.permissionMode}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{agent.description || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {agent.isGlobal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>}
                    {agent.tools.length > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{agent.tools.length} tools</Badge>}
                    {agent.maxTurns && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{agent.maxTurns} turnos</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(agent)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggle(agent)}>
                        {agent.enabled ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
                      </DropdownMenuItem>
                      {hasGitHub && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onResync(agent)} disabled={isResyncing}>
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
                      <DropdownMenuItem onClick={() => onDelete(agent)} className="text-destructive">
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
