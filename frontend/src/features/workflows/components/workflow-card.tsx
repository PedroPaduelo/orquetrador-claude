import { MoreHorizontal, Pencil, Trash2, MessageSquare, GitBranch, Play, Copy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { formatDate } from '@/shared/lib/utils'
import type { Workflow } from '../types'

interface WorkflowCardProps {
  workflow: Workflow
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}

export function WorkflowCard({ workflow, onEdit, onDelete, onDuplicate }: WorkflowCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="group hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
              {workflow.name}
            </h3>
            {workflow.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {workflow.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/conversations')}>
                <Play className="mr-2 h-4 w-4" />
                Nova Conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant="outline"
            className={
              workflow.type === 'sequential'
                ? 'border-primary/30 text-primary bg-primary/5'
                : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
            }
          >
            {workflow.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
          </Badge>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{workflow.stepsCount || 0} steps</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{workflow.conversationsCount || 0}</span>
          </div>
        </div>

        {/* Steps visualization - mini dots */}
        {(workflow.stepsCount || 0) > 0 && (
          <div className="flex items-center gap-1 mt-3">
            {Array.from({ length: Math.min(workflow.stepsCount || 0, 8) }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full bg-primary/20 max-w-[40px]"
              />
            ))}
            {(workflow.stepsCount || 0) > 8 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                +{(workflow.stepsCount || 0) - 8}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end mt-4 pt-3 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground">
            {formatDate(workflow.updatedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
