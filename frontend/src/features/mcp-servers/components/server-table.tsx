import { Server, Wifi, WifiOff, Terminal, Globe, MoreVertical, Trash2, Pencil, Play } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { McpServer } from '../types'

interface ServerTableProps {
  servers: McpServer[]
  onEdit: (server: McpServer) => void
  onDelete: (server: McpServer) => void
  onTest: (server: McpServer) => void
  onToggle: (server: McpServer) => void
}

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  sse: Wifi,
  stdio: Terminal,
}

export function ServerTable({ servers, onEdit, onDelete, onTest, onToggle }: ServerTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Endpoint</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Descrição</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12"></th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server, index) => {
            const TypeIcon = typeIcons[server.type] || Server
            return (
              <tr
                key={server.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up ${!server.enabled ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Status dot */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      server.lastTestOk === true ? 'bg-emerald-500' :
                      server.lastTestOk === false ? 'bg-red-500' :
                      'bg-muted-foreground/30'
                    }`} />
                    <span className="text-[11px] text-muted-foreground">
                      {server.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </td>

                {/* Name */}
                <td className="px-4 py-3">
                  <span className="font-medium truncate block max-w-[200px]">{server.name}</span>
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <TypeIcon className="h-3 w-3" />
                    {server.type.toUpperCase()}
                  </Badge>
                </td>

                {/* Endpoint */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground/70 truncate block max-w-[250px] font-mono">
                    {server.type === 'stdio' ? server.command : server.uri}
                  </span>
                </td>

                {/* Description */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
                    {server.description || '—'}
                  </span>
                </td>

                {/* Flags */}
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {server.isGlobal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(server)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onTest(server)}>
                        <Play className="h-4 w-4 mr-2" />
                        Testar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggle(server)}>
                        {server.enabled ? (
                          <><WifiOff className="h-4 w-4 mr-2" />Desativar</>
                        ) : (
                          <><Wifi className="h-4 w-4 mr-2" />Ativar</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(server)} className="text-destructive">
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
