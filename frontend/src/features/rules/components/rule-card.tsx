import { ScrollText, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, Github, ExternalLink } from 'lucide-react'
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
import type { Rule } from '../types'

interface RuleCardProps {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onResync?: () => void
  isResyncing?: boolean
}

export function RuleCard({ rule, onEdit, onDelete, onToggle, onResync, isResyncing }: RuleCardProps) {
  const hasGitHub = rule.source === 'imported' && rule.repoOwner && rule.repoName

  return (
    <Card className={!rule.enabled ? 'opacity-60' : ''}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium truncate">{rule.name}</CardTitle>
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
              <DropdownMenuItem onClick={onToggle}>
                {rule.enabled ? (
                  <><PowerOff className="h-4 w-4 mr-2" />Desativar</>
                ) : (
                  <><Power className="h-4 w-4 mr-2" />Ativar</>
                )}
              </DropdownMenuItem>
              {hasGitHub && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onResync} disabled={isResyncing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isResyncing ? 'animate-spin' : ''}`} />
                    {isResyncing ? 'Sincronizando...' : 'Resincronizar'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(rule.repoUrl || `https://github.com/${rule.repoOwner}/${rule.repoName}`, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver no GitHub
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
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
          {hasGitHub && (
            <Badge variant="default" className="text-[10px] gap-1">
              <Github className="h-3 w-3" />
              {rule.repoOwner}/{rule.repoName}
            </Badge>
          )}
          {rule.source === 'imported' && !hasGitHub && <Badge variant="default" className="text-[10px]">Importado</Badge>}
          {rule.isGlobal && <Badge variant="outline">Global</Badge>}
          {rule.skillName && <Badge variant="secondary">{rule.skillName}</Badge>}
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{rule.description}</p>
        )}
        {rule.lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground">
            Sync: {new Date(rule.lastSyncedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
