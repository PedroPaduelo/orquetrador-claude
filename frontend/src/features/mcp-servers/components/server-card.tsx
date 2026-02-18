import { Server, Wifi, WifiOff, Terminal, Globe, MoreVertical, Trash2, Pencil, Play } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { McpServer } from '../types'

interface ServerCardProps {
  server: McpServer
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  onToggle: () => void
}

const typeIcons = {
  http: Globe,
  sse: Wifi,
  stdio: Terminal,
}

const typeBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  http: 'default',
  sse: 'secondary',
  stdio: 'outline',
}

export function ServerCard({ server, onEdit, onDelete, onTest, onToggle }: ServerCardProps) {
  const TypeIcon = typeIcons[server.type] || Server

  return (
    <Card className={!server.enabled ? 'opacity-60' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              server.lastTestOk === true ? 'bg-emerald-500' :
              server.lastTestOk === false ? 'bg-red-500' :
              'bg-muted-foreground/30'
            }`} />
            <CardTitle className="text-sm font-medium truncate">{server.name}</CardTitle>
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
              <DropdownMenuItem onClick={onTest}>
                <Play className="h-4 w-4 mr-2" />
                Testar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                {server.enabled ? (
                  <><WifiOff className="h-4 w-4 mr-2" />Desativar</>
                ) : (
                  <><Wifi className="h-4 w-4 mr-2" />Ativar</>
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
        <div className="flex items-center gap-2">
          <Badge variant={typeBadgeVariants[server.type] || 'outline'}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {server.type.toUpperCase()}
          </Badge>
          {server.isGlobal && <Badge variant="outline">Global</Badge>}
        </div>
        {server.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{server.description}</p>
        )}
        <p className="text-xs text-muted-foreground/70 truncate font-mono">
          {server.type === 'stdio' ? server.command : server.uri}
        </p>
      </CardContent>
    </Card>
  )
}
