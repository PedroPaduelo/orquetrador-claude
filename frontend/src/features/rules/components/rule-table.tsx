import { ScrollText, MoreVertical, Trash2, Pencil, Power, PowerOff, RefreshCw, Github, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Rule } from '../types'

interface RuleTableProps {
  rules: Rule[]
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  onToggle: (rule: Rule) => void
  onResync: (rule: Rule) => void
  isResyncing: boolean
}

export function RuleTable({ rules, onEdit, onDelete, onToggle, onResync, isResyncing }: RuleTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Origem</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Descrição</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Skill</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
            <th className="text-right px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, index) => {
            const hasGitHub = rule.source === 'imported' && rule.repoOwner && rule.repoName
            return (
              <tr
                key={rule.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in-up ${!rule.enabled ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium truncate block max-w-[200px]">{rule.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-muted-foreground">{rule.enabled ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {hasGitHub ? (
                    <Badge variant="default" className="text-[10px] gap-1">
                      <Github className="h-3 w-3" />
                      {rule.repoOwner}/{rule.repoName}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{rule.source === 'imported' ? 'Importado' : 'Manual'}</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{rule.description || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {rule.skillName ? <Badge variant="secondary" className="text-[10px]">{rule.skillName}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {rule.isGlobal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>}
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
                      <DropdownMenuItem onClick={() => onEdit(rule)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggle(rule)}>
                        {rule.enabled ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
                      </DropdownMenuItem>
                      {hasGitHub && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onResync(rule)} disabled={isResyncing}>
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
                      <DropdownMenuItem onClick={() => onDelete(rule)} className="text-destructive">
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
