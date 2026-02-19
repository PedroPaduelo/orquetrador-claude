import { ScrollText, MoreVertical, Trash2, Pencil, Power, PowerOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { Rule } from '../types'

interface RuleCardProps {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

export function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
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
          {rule.source === 'imported' && <Badge variant="default" className="text-[10px]">Importado</Badge>}
          {rule.isGlobal && <Badge variant="outline">Global</Badge>}
          {rule.skillName && <Badge variant="secondary">{rule.skillName}</Badge>}
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{rule.description}</p>
        )}
      </CardContent>
    </Card>
  )
}
