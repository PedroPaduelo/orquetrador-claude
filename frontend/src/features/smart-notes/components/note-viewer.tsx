import { useState } from 'react'
import { X, Pencil, Save, Pin, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatDate } from '@/shared/lib/utils'
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
  usePinNote,
  useUnpinNote,
  useArchiveNote,
  useUnarchiveNote,
} from '../hooks/use-smart-notes'
import { useSmartNotesStore } from '../store'

export function NoteViewer() {
  const { selectedNoteId, setSelectedNoteId } = useSmartNotesStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const { data: note, isLoading } = useNote(selectedNoteId!)
  const updateMutation = useUpdateNote()
  const deleteMutation = useDeleteNote()
  const pinMutation = usePinNote()
  const unpinMutation = useUnpinNote()
  const archiveMutation = useArchiveNote()
  const unarchiveMutation = useUnarchiveNote()

  if (!selectedNoteId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Selecione uma nota para visualizar</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Nota nao encontrada</p>
      </div>
    )
  }

  const startEditing = () => {
    setEditTitle(note.title)
    setEditContent(note.content || '')
    setIsEditing(true)
  }

  const saveChanges = async () => {
    await updateMutation.mutateAsync({
      id: note.id,
      title: editTitle,
      content: editContent,
    })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(note.id)
    setSelectedNoteId(null)
  }

  const handlePin = () => {
    if (note.isPinned) {
      unpinMutation.mutate(note.id)
    } else {
      pinMutation.mutate(note.id)
    }
  }

  const handleArchive = () => {
    if (note.isArchived) {
      unarchiveMutation.mutate(note.id)
    } else {
      archiveMutation.mutate(note.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {note.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-semibold"
            />
          ) : (
            <h2 className="text-lg font-semibold">{note.title}</h2>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveChanges} disabled={updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePin}>
                <Pin className={note.isPinned ? 'h-4 w-4 fill-yellow-500 text-yellow-500' : 'h-4 w-4'} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleArchive}>
                <Archive className={note.isArchived ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNoteId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Meta */}
      {note.updatedAt && (
        <div className="px-4 py-2 border-b text-sm text-muted-foreground">
          <p>Atualizado em {formatDate(note.updatedAt)}</p>
        </div>
      )}

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-4 py-2 border-b flex flex-wrap gap-1">
          {note.tags.map((tag, index) => {
            const tagName = typeof tag === 'string' ? tag : tag.name
            const tagColor = typeof tag === 'string' ? undefined : tag.color || undefined
            return (
              <Badge
                key={tagName || index}
                variant="outline"
                style={{ borderColor: tagColor }}
              >
                {tagName}
              </Badge>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[400px] resize-none"
          />
        ) : note.contentType === 'html' ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: (note.content || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/on\w+="[^"]*"/gi, '') }}
          />
        ) : (
          <div className="whitespace-pre-wrap">{note.content}</div>
        )}
      </div>
    </div>
  )
}
