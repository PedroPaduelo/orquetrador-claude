import { Package, MoreVertical, Trash2, Power, PowerOff, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Plugin } from '../types'

interface PluginCardProps {
  plugin: Plugin
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onResync?: () => void
}

export function PluginCard({ plugin, onEdit, onDelete, onToggle, onResync }: PluginCardProps) {
  return (
    <Card className={!plugin.enabled ? 'opacity-60' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm font-medium truncate">{plugin.name}</CardTitle>
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
              {plugin.source === 'imported' && onResync && (
                <DropdownMenuItem onClick={onResync}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-sincronizar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onToggle}>
                {plugin.enabled ? (
                  <><PowerOff className="h-4 w-4 mr-2" />Desativar</>
                ) : (
                  <><Power className="h-4 w-4 mr-2" />Ativar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {plugin.source === 'imported' && <Badge variant="default" className="text-[10px]">Importado</Badge>}
          {plugin.version && <Badge variant="secondary">v{plugin.version}</Badge>}
          {plugin.author && <Badge variant="outline">{plugin.author}</Badge>}
        </div>
        {plugin.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {plugin.mcpServersCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {plugin.mcpServersCount} MCP
            </Badge>
          )}
          {plugin.skillsCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {plugin.skillsCount} Skills
            </Badge>
          )}
          {plugin.agentsCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {plugin.agentsCount} Agents
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
