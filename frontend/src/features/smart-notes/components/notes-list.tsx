import { useState } from 'react'
import { Plus, Search, Grid, List, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { NoteCard } from './note-card'
import {
  useNotes,
  useSearchNotes,
  useCreateNote,
  useDeleteNote,
  usePinNote,
  useUnpinNote,
  useArchiveNote,
  useUnarchiveNote,
} from '../hooks/use-smart-notes'
import { useSmartNotesStore } from '../store'
import { cn } from '@/shared/lib/utils'

export function NotesList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const {
    selectedFolderId,
    selectedNoteId,
    setSelectedNoteId,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
  } = useSmartNotesStore()

  const { data: notes, isLoading, refetch } = useNotes({
    folderId: selectedFolderId || undefined,
  })

  const { data: searchResults } = useSearchNotes({
    query: searchQuery,
    limit: 50,
  })

  const createMutation = useCreateNote()
  const deleteMutation = useDeleteNote()
  const pinMutation = usePinNote()
  const unpinMutation = useUnpinNote()
  const archiveMutation = useArchiveNote()
  const unarchiveMutation = useUnarchiveNote()

  const displayedNotes = searchQuery ? searchResults : notes

  const handleCreateNote = async () => {
    if (!newTitle.trim()) return
    const result = await createMutation.mutateAsync({
      title: newTitle.trim(),
      content: newContent,
      folderId: selectedFolderId || undefined,
    })
    setNewTitle('')
    setNewContent('')
    setIsDialogOpen(false)
    setSelectedNoteId(result.id)
  }

  const handlePin = (noteId: string, isPinned: boolean) => {
    if (isPinned) {
      unpinMutation.mutate(noteId)
    } else {
      pinMutation.mutate(noteId)
    }
  }

  const handleArchive = (noteId: string, isArchived: boolean) => {
    if (isArchived) {
      unarchiveMutation.mutate(noteId)
    } else {
      archiveMutation.mutate(noteId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Notas</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', viewMode === 'list' && 'bg-muted')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', viewMode === 'grid' && 'bg-muted')}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Nota</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Titulo</Label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Titulo da nota"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conteudo</Label>
                    <Textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Conteudo da nota..."
                      className="min-h-[150px]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNote} disabled={!newTitle.trim()}>
                    Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notas..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : displayedNotes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p>Nenhuma nota encontrada</p>
            {searchQuery && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setSearchQuery('')}
              >
                Limpar busca
              </Button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid gap-3 grid-cols-1 sm:grid-cols-2'
                : 'space-y-2'
            )}
          >
            {displayedNotes?.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onSelect={() => setSelectedNoteId(note.id)}
                onDelete={() => deleteMutation.mutate(note.id)}
                onArchive={() => handleArchive(note.id, note.isArchived)}
                onPin={() => handlePin(note.id, note.isPinned)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
