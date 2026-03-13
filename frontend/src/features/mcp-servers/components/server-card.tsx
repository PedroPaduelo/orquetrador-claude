import { Server, Wifi, WifiOff, Terminal, Globe, MoreVertical, Trash2, Pencil, Play, ShieldAlert } from 'lucide-react'
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
      <div className="h-0.5 bg-gradient-to-r from-blue-500/60 via-blue-500/20 to-transparent" />
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={typeBadgeVariants[server.type] || 'outline'}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {server.type.toUpperCase()}
          </Badge>
          {server.isGlobal && <Badge variant="outline">Global</Badge>}
          <CircuitBreakerBadge status={(server as unknown as Record<string, unknown>).circuitBreakerStatus as string | undefined} />
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

function CircuitBreakerBadge({ status }: { status: string | undefined }) {
  if (!status || status === 'closed') return null

  if (status === 'open') {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
        <ShieldAlert className="h-2.5 w-2.5 mr-1" />
        Circuit Open
      </Badge>
    )
  }

  if (status === 'half-open') {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30"
      >
        <ShieldAlert className="h-2.5 w-2.5 mr-1" />
        Half-Open
      </Badge>
    )
  }

  return null
}
