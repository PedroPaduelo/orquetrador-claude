import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Plus, FolderPlus, ChevronRight,
  Folder as FolderIcon, FolderOpen,
  FileText, Code, Pin, Archive, Loader2,
  MoreHorizontal, Trash2,
} from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'
import { listNotes } from '../api'
import {
  useFolders, useSearchNotes,
  useCreateNote, useCreateFolder, useDeleteFolder,
} from '../hooks/use-smart-notes'
import { useSmartNotesStore } from '../store'
import type { Folder, NotePreview } from '../types'

export function FolderTree() {
  const {
    searchQuery, setSearchQuery,
    selectedNoteId, setSelectedNoteId,
    expandedFolderIds, toggleFolder,
  } = useSmartNotesStore()

  const { data: folders = [] } = useFolders()
  const { data: searchResults = [] } = useSearchNotes({ query: searchQuery, limit: 30 })

  // Root notes (notes without a folder) — fetched separately
  const { data: rootNotes = [] } = useQuery({
    queryKey: ['smart-notes', 'notes', 'root'],
    queryFn: () => listNotes(),
  })

  // Filter for notes that have no folder
  const actualRootNotes = useMemo(() => {
    const sorted = [...rootNotes].filter((n) => !n.folderId)
    sorted.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
    })
    return sorted
  }, [rootNotes])

  const createNote = useCreateNote()
  const createFolderMutation = useCreateFolder()
  const deleteFolderMutation = useDeleteFolder()

  const [newFolderDialog, setNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const handleCreateNote = async (folderId?: string) => {
    try {
      const note = await createNote.mutateAsync({
        title: 'Nova nota',
        content: '',
        contentType: 'richtext',
        folderId: folderId || undefined,
      })
      if (note?.id) setSelectedNoteId(note.id)
    } catch (e) {
      console.error('Failed to create note', e)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolderMutation.mutateAsync({ name: newFolderName.trim() })
      setNewFolderName('')
      setNewFolderDialog(false)
    } catch (e) {
      console.error('Failed to create folder', e)
    }
  }

  const isSearching = searchQuery.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleCreateNote()}
            title="Nova nota"
            disabled={createNote.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setNewFolderDialog(true)}
            title="Nova pasta"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notas..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {isSearching ? (
          <div className="py-1">
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
              Resultados ({searchResults.length})
            </div>
            {searchResults.map((note) => (
              <NoteTreeItem
                key={note.id}
                note={note}
                level={0}
                isSelected={note.id === selectedNoteId}
                onSelect={() => setSelectedNoteId(note.id)}
              />
            ))}
            {searchResults.length === 0 && (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                Nenhum resultado encontrado
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                level={0}
                selectedNoteId={selectedNoteId}
                expandedFolderIds={expandedFolderIds}
                onToggle={toggleFolder}
                onNoteSelect={setSelectedNoteId}
                onCreateNote={handleCreateNote}
                onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
              />
            ))}

            {/* Root notes (no folder) */}
            {actualRootNotes.length > 0 && (
              <div className="mt-2">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  Notas ({actualRootNotes.length})
                </div>
                {actualRootNotes.map((note) => (
                  <NoteTreeItem
                    key={note.id}
                    note={note}
                    level={0}
                    isSelected={note.id === selectedNoteId}
                    onSelect={() => setSelectedNoteId(note.id)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {folders.length === 0 && actualRootNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-xs">Nenhuma nota ainda</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 mt-1"
                  onClick={() => handleCreateNote()}
                >
                  <Plus className="mr-1.5 h-3 w-3" />
                  Criar nota
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da pasta"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ────────────────────────────────────────
// FolderTreeItem (recursive)
// Each folder fetches its own notes when expanded.
// ────────────────────────────────────────

interface FolderTreeItemProps {
  folder: Folder
  level: number
  selectedNoteId: string | null
  expandedFolderIds: Set<string>
  onToggle: (id: string) => void
  onNoteSelect: (id: string) => void
  onCreateNote: (folderId: string) => void
  onDeleteFolder: (id: string) => void
}

function FolderTreeItem({
  folder, level, selectedNoteId, expandedFolderIds,
  onToggle, onNoteSelect, onCreateNote, onDeleteFolder,
}: FolderTreeItemProps) {
  const isExpanded = expandedFolderIds.has(folder.id)

  // Fetch notes for THIS folder — only when expanded
  const { data: folderNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['smart-notes', 'notes', 'folder', folder.id],
    queryFn: () => listNotes({ folderId: folder.id }),
    enabled: isExpanded,
  })

  // Sort: pinned first, then by updatedAt desc
  const sortedNotes = useMemo(() => {
    return [...folderNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
    })
  }, [folderNotes])

  const hasChildren = !!(folder.children?.length) || (folder.noteCount ?? 0) > 0
  const noteCount = folder.noteCount ?? folderNotes.length

  return (
    <div>
      {/* Folder row */}
      <div
        className="group flex items-center gap-1 py-1 rounded-md cursor-pointer hover:bg-muted/50 text-sm"
        style={{ paddingLeft: `${8 + level * 16}px`, paddingRight: '8px' }}
        onClick={() => onToggle(folder.id)}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-90',
            !hasChildren && 'invisible',
          )}
        />

        {isExpanded ? (
          <FolderOpen
            className="h-4 w-4 shrink-0"
            style={{ color: folder.color || 'hsl(var(--primary))' }}
          />
        ) : (
          <FolderIcon
            className="h-4 w-4 shrink-0 text-muted-foreground"
            style={folder.color ? { color: folder.color } : undefined}
          />
        )}

        <span className="flex-1 truncate ml-1">{folder.name}</span>

        {noteCount > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums mr-1">
            {noteCount}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => onCreateNote(folder.id)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Nova nota aqui
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDeleteFolder(folder.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Excluir pasta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded children */}
      {isExpanded && (
        <div>
          {/* Child folders */}
          {folder.children?.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedNoteId={selectedNoteId}
              expandedFolderIds={expandedFolderIds}
              onToggle={onToggle}
              onNoteSelect={onNoteSelect}
              onCreateNote={onCreateNote}
              onDeleteFolder={onDeleteFolder}
            />
          ))}

          {/* Loading indicator */}
          {isLoadingNotes && (
            <div
              className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${28 + (level + 1) * 16}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          )}

          {/* Notes inside this folder */}
          {sortedNotes.map((note) => (
            <NoteTreeItem
              key={note.id}
              note={note}
              level={level + 1}
              isSelected={note.id === selectedNoteId}
              onSelect={() => onNoteSelect(note.id)}
            />
          ))}

          {/* Empty folder (done loading, no children, no notes) */}
          {!isLoadingNotes && !folder.children?.length && sortedNotes.length === 0 && (
            <div
              className="text-[11px] text-muted-foreground/60 italic py-1"
              style={{ paddingLeft: `${28 + (level + 1) * 16}px` }}
            >
              Pasta vazia
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────
// NoteTreeItem
// ────────────────────────────────────────

interface NoteTreeItemProps {
  note: NotePreview
  level: number
  isSelected: boolean
  onSelect: () => void
}

function NoteTreeItem({ note, level, isSelected, onSelect }: NoteTreeItemProps) {
  const isHtml = note.contentType === 'html'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-sm transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : 'hover:bg-muted/50',
      )}
      style={{ paddingLeft: `${28 + level * 16}px`, paddingRight: '8px' }}
      onClick={onSelect}
    >
      {isHtml ? (
        <Code className="h-3.5 w-3.5 shrink-0 text-orange-500" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate">{note.title || 'Sem título'}</span>
      {note.isPinned && <Pin className="h-3 w-3 shrink-0 fill-yellow-500 text-yellow-500" />}
      {note.isArchived && <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </div>
  )
}
