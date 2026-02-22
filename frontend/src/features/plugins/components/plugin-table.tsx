import { Package, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Plugin } from '../types'

interface PluginTableProps {
  plugins: Plugin[]
  onEdit: (plugin: Plugin) => void
  onDelete: (plugin: Plugin) => void
  onToggle: (plugin: Plugin) => void
  onResync: (plugin: Plugin) => void
}

export function PluginTable({ plugins, onEdit, onDelete, onToggle, onResync }: PluginTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Versão</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Autor</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Descrição</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recursos</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin, index) => (
            <tr
              key={plugin.id}
              className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up ${!plugin.enabled ? 'opacity-60' : ''}`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span className="font-medium truncate block max-w-[200px]">{plugin.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-[11px] text-muted-foreground">{plugin.enabled ? 'Ativo' : 'Inativo'}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {plugin.version ? <Badge variant="secondary" className="text-[10px]">v{plugin.version}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs text-muted-foreground">{plugin.author || '—'}</span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{plugin.description || '—'}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {plugin.mcpServersCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{plugin.mcpServersCount} MCP</Badge>}
                  {plugin.skillsCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{plugin.skillsCount} Skills</Badge>}
                  {plugin.agentsCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{plugin.agentsCount} Agents</Badge>}
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
                    <DropdownMenuItem onClick={() => onEdit(plugin)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    {plugin.source === 'imported' && (
                      <DropdownMenuItem onClick={() => onResync(plugin)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-sincronizar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onToggle(plugin)}>
                      {plugin.enabled ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(plugin)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
