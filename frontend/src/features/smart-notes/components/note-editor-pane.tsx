import { useState, useEffect, useRef } from 'react'
import { FileText, Code, Pin, Archive, Trash2, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  useNote, useUpdateNote, useDeleteNote,
  usePinNote, useUnpinNote,
  useArchiveNote, useUnarchiveNote,
} from '../hooks/use-smart-notes'
import { useSmartNotesStore } from '../store'
import { BlockEditor } from './block-editor'
import { HtmlViewer } from './html-viewer'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function NoteEditorPane() {
  const { selectedNoteId, setSelectedNoteId } = useSmartNotesStore()
  const { data: note, isLoading } = useNote(selectedNoteId ?? '')
  const updateMutation = useUpdateNote()
  const deleteMutation = useDeleteNote()
  const pinMutation = usePinNote()
  const unpinMutation = useUnpinNote()
  const archiveMutation = useArchiveNote()
  const unarchiveMutation = useUnarchiveNote()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null)

  const loadedNoteIdRef = useRef<string | null>(null)
  const lastSavedRef = useRef({ title: '', content: '' })

  const isHtml = note?.contentType === 'html'

  // Load note data when a different note is selected
  useEffect(() => {
    if (note && note.id !== loadedNoteIdRef.current) {
      setTitle(note.title)
      setContent(note.content || '')
      loadedNoteIdRef.current = note.id
      lastSavedRef.current = { title: note.title, content: note.content || '' }
      setSaveStatus(null)
    }
  }, [note])

  // Clear state when no note is selected
  useEffect(() => {
    if (!selectedNoteId) {
      loadedNoteIdRef.current = null
      setTitle('')
      setContent('')
      setSaveStatus(null)
    }
  }, [selectedNoteId])

  // Auto-save
  const debouncedTitle = useDebounce(title, 2000)
  const debouncedContent = useDebounce(content, 2000)

  useEffect(() => {
    const noteId = loadedNoteIdRef.current
    if (!noteId) return

    const titleChanged = debouncedTitle !== lastSavedRef.current.title
    const contentChanged = debouncedContent !== lastSavedRef.current.content

    if (!titleChanged && !contentChanged) return

    setSaveStatus('saving')
    updateMutation
      .mutateAsync({ id: noteId, title: debouncedTitle, content: debouncedContent })
      .then(() => {
        lastSavedRef.current = { title: debouncedTitle, content: debouncedContent }
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      })
      .catch(() => {
        setSaveStatus('unsaved')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedContent])

  // Mark as unsaved when user types
  useEffect(() => {
    if (!loadedNoteIdRef.current) return
    const titleChanged = title !== lastSavedRef.current.title
    const contentChanged = content !== lastSavedRef.current.content
    if (titleChanged || contentChanged) {
      setSaveStatus('unsaved')
    }
  }, [title, content])

  const handleDelete = async () => {
    if (!note) return
    if (!window.confirm('Tem certeza que deseja excluir esta nota?')) return
    await deleteMutation.mutateAsync(note.id)
    setSelectedNoteId(null)
  }

  const handlePin = () => {
    if (!note) return
    note.isPinned ? unpinMutation.mutate(note.id) : pinMutation.mutate(note.id)
  }

  const handleArchive = () => {
    if (!note) return
    note.isArchived ? unarchiveMutation.mutate(note.id) : archiveMutation.mutate(note.id)
  }

  // ── Empty state ──
  if (!selectedNoteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm">Selecione uma nota para editar</p>
        <p className="text-xs text-muted-foreground/60">
          Ou crie uma nova nota usando o botão + na barra lateral
        </p>
      </div>
    )
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
      </div>
    )
  }

  // ── Not found ──
  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm">Nota não encontrada</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        {isHtml ? (
          <Code className="h-4 w-4 text-orange-500 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {note.isPinned && (
          <Pin className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 shrink-0" />
        )}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold h-8 border-0 shadow-none focus-visible:ring-0 px-0 flex-1"
          placeholder="Título da nota"
        />

        {/* Save status */}
        <div className="text-xs text-muted-foreground shrink-0 min-w-[70px] text-right">
          {saveStatus === 'saving' && 'Salvando...'}
          {saveStatus === 'saved' && '✓ Salvo'}
          {saveStatus === 'unsaved' && '● Não salvo'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePin}
            title={note.isPinned ? 'Desafixar' : 'Fixar'}
          >
            <Pin className={note.isPinned ? 'h-4 w-4 fill-yellow-500 text-yellow-500' : 'h-4 w-4'} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleArchive}
            title={note.isArchived ? 'Desarquivar' : 'Arquivar'}
          >
            <Archive className={note.isArchived ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleDelete}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedNoteId(null)}
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Tags ── */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-4 py-1.5 border-b flex flex-wrap gap-1 shrink-0">
          {note.tags.map((tag, i) => {
            const tagName = typeof tag === 'string' ? tag : tag.name
            const tagColor = typeof tag === 'string' ? undefined : tag.color || undefined
            return (
              <Badge
                key={tagName || i}
                variant="secondary"
                className="text-[10px] h-5 px-1.5"
                style={
                  tagColor
                    ? { backgroundColor: tagColor + '20', color: tagColor, borderColor: tagColor + '40' }
                    : undefined
                }
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
          <HtmlViewer content={content} onChange={setContent} />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="max-w-[80%] mx-auto">
              <BlockEditor content={content} onChange={setContent} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
