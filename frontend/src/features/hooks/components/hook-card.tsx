import {
  Webhook,
  MoreVertical,
  Trash2,
  Pencil,
  Power,
  PowerOff,
  Terminal,
  MessageSquare,
  Bot,
  Zap,
  Clock,
  Shield,
} from 'lucide-react'
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
import type { Hook } from '../types'

interface HookCardProps {
  hook: Hook
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

const handlerIcons = {
  command: Terminal,
  prompt: MessageSquare,
  agent: Bot,
}

const handlerLabels = {
  command: 'Comando',
  prompt: 'Prompt',
  agent: 'Agente',
}

const categoryColors: Record<string, string> = {
  tools: 'from-blue-500/60 via-blue-500/20',
  lifecycle: 'from-emerald-500/60 via-emerald-500/20',
  workflow: 'from-purple-500/60 via-purple-500/20',
  system: 'from-amber-500/60 via-amber-500/20',
}

const eventCategories: Record<string, string> = {
  PreToolUse: 'tools',
  PostToolUse: 'tools',
  PostToolUseFailure: 'tools',
  PermissionRequest: 'tools',
  Stop: 'lifecycle',
  UserPromptSubmit: 'lifecycle',
  Notification: 'lifecycle',
  SessionStart: 'lifecycle',
  SessionEnd: 'lifecycle',
  SubagentStart: 'workflow',
  SubagentStop: 'workflow',
  TeammateIdle: 'workflow',
  TaskCompleted: 'workflow',
  PreCompact: 'system',
  WorktreeCreate: 'system',
  WorktreeRemove: 'system',
}

export function HookCard({ hook, onEdit, onDelete, onToggle }: HookCardProps) {
  const HandlerIcon = handlerIcons[hook.handlerType] || Terminal
  const category = eventCategories[hook.eventType] || 'system'
  const gradientColor = categoryColors[category] || categoryColors.system

  return (
    <Card className={`group transition-all duration-200 hover:shadow-md ${!hook.enabled ? 'opacity-50' : ''}`}>
      <div className={`h-0.5 bg-gradient-to-r ${gradientColor} to-transparent`} />
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Webhook className="h-3.5 w-3.5 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium truncate">{hook.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                {hook.enabled ? (
                  <><PowerOff className="h-4 w-4 mr-2" />Desativar</>
                ) : (
                  <><Power className="h-4 w-4 mr-2" />Ativar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="py-3 space-y-3">
        {hook.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{hook.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Zap className="h-2.5 w-2.5" />
            {hook.eventType}
          </Badge>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <HandlerIcon className="h-2.5 w-2.5" />
            {handlerLabels[hook.handlerType]}
          </Badge>
          {hook.matcher && (
            <Badge variant="default" className="text-[10px] gap-1">
              <Shield className="h-2.5 w-2.5" />
              {hook.matcher}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {hook.isAsync && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Async
            </span>
          )}
          {hook.isGlobal && (
            <span>Global</span>
          )}
          <span>{(hook.timeout / 1000)}s timeout</span>
        </div>

        {hook.command && (
          <div className="bg-muted/50 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground truncate">
            $ {hook.command}
          </div>
        )}
        {hook.prompt && !hook.command && (
          <div className="bg-muted/50 rounded-md px-2.5 py-1.5 text-[10px] text-muted-foreground line-clamp-2 italic">
            {hook.prompt}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
