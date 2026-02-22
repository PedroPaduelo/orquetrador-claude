import { Sparkles, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, Github, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Skill } from '../types'

interface SkillTableProps {
  skills: Skill[]
  onEdit: (skill: Skill) => void
  onDelete: (skill: Skill) => void
  onToggle: (skill: Skill) => void
  onResync: (skill: Skill) => void
  isResyncing: boolean
}

export function SkillTable({ skills, onEdit, onDelete, onToggle, onResync, isResyncing }: SkillTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Origem</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Descrição</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Model</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill, index) => {
            const hasGitHub = skill.source === 'imported' && skill.repoOwner && skill.repoName
            return (
              <tr
                key={skill.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up ${!skill.enabled ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium truncate block max-w-[200px]">{skill.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-muted-foreground">{skill.enabled ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {hasGitHub ? (
                    <Badge variant="default" className="text-[10px] gap-1">
                      <Github className="h-3 w-3" />
                      {skill.repoOwner}/{skill.repoName}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{skill.source === 'imported' ? 'Importado' : 'Manual'}</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{skill.description || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {skill.model ? <Badge variant="secondary" className="text-[10px]">{skill.model}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {skill.isGlobal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>}
                    {skill.allowedTools.length > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{skill.allowedTools.length} tools</Badge>}
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
                      <DropdownMenuItem onClick={() => onEdit(skill)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggle(skill)}>
                        {skill.enabled ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
                      </DropdownMenuItem>
                      {hasGitHub && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onResync(skill)} disabled={isResyncing}>
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
                      <DropdownMenuItem onClick={() => onDelete(skill)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
