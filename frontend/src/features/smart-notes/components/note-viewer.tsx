import { useState, useEffect, useCallback } from 'react'
import { X, Pencil, Save, Pin, Archive, Trash2, FileText, Code } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
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
import { BlockEditor } from './block-editor'
import { HtmlViewer } from './html-viewer'

export function NoteViewer() {
  const { selectedNoteId, setSelectedNoteId } = useSmartNotesStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data: note, isLoading } = useNote(selectedNoteId!)
  const updateMutation = useUpdateNote()
  const deleteMutation = useDeleteNote()
  const pinMutation = usePinNote()
  const unpinMutation = useUnpinNote()
  const archiveMutation = useArchiveNote()
  const unarchiveMutation = useUnarchiveNote()

  const isHtml = note?.contentType === 'html'

  // Reset edit state when note changes
  useEffect(() => {
    setIsEditing(false)
  }, [selectedNoteId])

  const startEditing = useCallback(() => {
    if (!note) return
    setEditTitle(note.title)
    setEditContent(note.content || '')
    setIsEditing(true)
  }, [note])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditTitle('')
    setEditContent('')
  }, [])

  const saveChanges = useCallback(async () => {
    if (!note) return
    setIsSaving(true)
    try {
      await updateMutation.mutateAsync({
        id: note.id,
        title: editTitle,
        content: editContent,
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }, [note, editTitle, editContent, updateMutation])

  const handleDelete = async () => {
    if (!note) return
    await deleteMutation.mutateAsync(note.id)
    setSelectedNoteId(null)
  }

  const handlePin = () => {
    if (!note) return
    if (note.isPinned) {
      unpinMutation.mutate(note.id)
    } else {
      pinMutation.mutate(note.id)
    }
  }

  const handleArchive = () => {
    if (!note) return
    if (note.isArchived) {
      unarchiveMutation.mutate(note.id)
    } else {
      archiveMutation.mutate(note.id)
    }
  }

  // --- Empty state ---
  if (!selectedNoteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">Selecione uma nota para visualizar</p>
      </div>
    )
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // --- Not found ---
  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">Nota não encontrada</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Type icon */}
          {isHtml ? (
            <Code className="h-4 w-4 text-orange-500 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          {note.isPinned && <Pin className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}

          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-semibold h-8"
              autoFocus
            />
          ) : (
            <h2 className="text-lg font-semibold truncate">{note.title}</h2>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveChanges} disabled={isSaving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePin} title={note.isPinned ? 'Desafixar' : 'Fixar'}>
                <Pin className={note.isPinned ? 'h-4 w-4 fill-yellow-500 text-yellow-500' : 'h-4 w-4'} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleArchive} title={note.isArchived ? 'Desarquivar' : 'Arquivar'}>
                <Archive className={note.isArchived ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete} title="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedNoteId(null)} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Meta bar ── */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b text-xs text-muted-foreground shrink-0">
        {note.updatedAt && (
          <span>Atualizado {formatDate(note.updatedAt)}</span>
        )}
        {isHtml && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-orange-500 border-orange-500/30">
            HTML
          </Badge>
        )}
      </div>

      {/* ── Tags ── */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-4 py-1.5 border-b flex flex-wrap gap-1 shrink-0">
          {note.tags.map((tag, index) => {
            const tagName = typeof tag === 'string' ? tag : tag.name
            const tagColor = typeof tag === 'string' ? undefined : tag.color || undefined
            return (
              <Badge
                key={tagName || index}
                variant="secondary"
                className="text-[10px] h-5 px-1.5"
                style={tagColor ? { backgroundColor: tagColor + '20', color: tagColor, borderColor: tagColor + '40' } : undefined}
              >
                {tagName}
              </Badge>
            )
          })}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {isHtml ? (
          /* HTML notes: iframe preview + code editor */
          <HtmlViewer
            content={isEditing ? editContent : (note.content || '')}
            onChange={isEditing ? setEditContent : undefined}
            readOnly={!isEditing}
          />
        ) : isEditing ? (
          /* Richtext edit mode: Tiptap editor */
          <div className="h-full overflow-y-auto">
            <BlockEditor
              content={editContent}
              onChange={setEditContent}
            />
          </div>
        ) : (
          /* Richtext view mode: prose rendered */
          <div className="h-full overflow-y-auto">
            <div className="max-w-[80%] mx-auto py-6">
              {note.content ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:font-semibold
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                    prose-pre:bg-zinc-950 prose-pre:text-zinc-100 prose-pre:rounded-lg
                    prose-img:rounded-lg prose-img:shadow-sm
                    prose-blockquote:border-l-primary/50"
                  dangerouslySetInnerHTML={{
                    __html: note.content
                      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                      .replace(/on\w+="[^"]*"/gi, ''),
                  }}
                />
              ) : (
                <p className="text-muted-foreground italic">Nota sem conteúdo</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
