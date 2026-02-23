import { MoreVertical, Pencil, Trash2, Play, Copy, GitBranch, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

interface WorkflowTableProps {
  workflows: Workflow[]
  onEdit: (workflow: Workflow) => void
  onDelete: (workflow: Workflow) => void
  onDuplicate: (workflow: Workflow) => void
}

export function WorkflowTable({ workflows, onEdit, onDelete, onDuplicate }: WorkflowTableProps) {
  const navigate = useNavigate()

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Steps</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Conversas</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Atualizado</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((workflow, index) => (
            <tr
              key={workflow.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <td className="px-4 py-3">
                <div className="min-w-0">
                  <span className="font-medium truncate block max-w-[250px]">{workflow.name}</span>
                  {workflow.description && (
                    <span className="text-xs text-muted-foreground truncate block max-w-[250px]">{workflow.description}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    workflow.type === 'sequential'
                      ? 'border-primary/30 text-primary bg-primary/5 text-[10px]'
                      : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px]'
                  }
                >
                  {workflow.type === 'sequential' ? 'Sequencial' : 'Passo a Passo'}
                </Badge>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>{workflow.stepsCount || 0}</span>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{workflow.conversationsCount || 0}</span>
                </div>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground">{formatDate(workflow.updatedAt)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(workflow)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/conversations')}>
                      <Play className="h-4 w-4 mr-2" />
                      Nova Conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(workflow)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
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
