import { MoreHorizontal, Pencil, Trash2, MessageSquare, GitBranch } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { formatDate, truncate } from '@/shared/lib/utils'
import type { Workflow } from '../types'

interface WorkflowCardProps {
  workflow: Workflow
  onEdit: () => void
  onDelete: () => void
}

export function WorkflowCard({ workflow, onEdit, onDelete }: WorkflowCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">{workflow.name}</CardTitle>
          {workflow.description && (
            <p className="text-sm text-muted-foreground">
              {truncate(workflow.description, 100)}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Badge variant={workflow.type === 'sequential' ? 'default' : 'secondary'}>
            {workflow.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
          </Badge>

          <div className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            <span>{workflow.stepsCount || 0} steps</span>
          </div>

          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{workflow.conversationsCount || 0} conversas</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Atualizado em {formatDate(workflow.updatedAt)}
        </p>
      </CardContent>
    </Card>
  )
}
