import { Sparkles, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, Github, ExternalLink } from 'lucide-react'
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
import type { Skill } from '../types'

interface SkillCardProps {
  skill: Skill
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onResync?: () => void
  isResyncing?: boolean
}

export function SkillCard({ skill, onEdit, onDelete, onToggle, onResync, isResyncing }: SkillCardProps) {
  const hasGitHub = skill.source === 'imported' && skill.repoOwner && skill.repoName

  return (
    <Card className={!skill.enabled ? 'opacity-60' : ''}>
      <div className="h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-500/20 to-transparent" />
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium truncate">{skill.name}</CardTitle>
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
                {skill.enabled ? (
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
                  <DropdownMenuItem onClick={() => window.open(skill.repoUrl || `https://github.com/${skill.repoOwner}/${skill.repoName}`, '_blank')}>
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
              {skill.repoOwner}/{skill.repoName}
            </Badge>
          )}
          {skill.source === 'imported' && !hasGitHub && <Badge variant="default" className="text-[10px]">Importado</Badge>}
          {skill.isGlobal && <Badge variant="outline">Global</Badge>}
          {skill.model && <Badge variant="secondary">{skill.model}</Badge>}
        </div>
        {skill.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
        )}
        {skill.allowedTools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.allowedTools.map((tool) => (
              <Badge key={tool} variant="outline" className="text-[10px] px-1.5 py-0">
                {tool}
              </Badge>
            ))}
          </div>
        )}
        {skill.lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground">
            Sync: {new Date(skill.lastSyncedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
