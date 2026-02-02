import { Pin, Archive, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { NotePreview } from '../types'

interface NoteCardProps {
  note: NotePreview
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onArchive: () => void
  onPin: () => void
}

export function NoteCard({
  note,
  isSelected,
  onSelect,
  onDelete,
  onArchive,
  onPin,
}: NoteCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
        isSelected && 'border-primary bg-primary/5'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
            <h3 className="font-medium truncate">{note.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {note.contentPreview}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onPin()
              }}
            >
              <Pin className="mr-2 h-4 w-4" />
              {note.isPinned ? 'Desafixar' : 'Fixar'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              {note.isArchived ? 'Desarquivar' : 'Arquivar'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {note.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-xs"
              style={{ borderColor: tag.color || undefined }}
            >
              {tag.name}
            </Badge>
          ))}
          {note.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{note.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Date */}
      <p className="text-xs text-muted-foreground mt-2">
        {formatDate(note.updatedAt)}
      </p>
    </div>
  )
}
