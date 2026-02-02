import { useState } from 'react'
import { Folder, FolderPlus, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { useFolders, useCreateFolder, useDeleteFolder } from '../hooks/use-smart-notes'
import { useSmartNotesStore } from '../store'
import type { Folder as FolderType } from '../types'

export function FolderList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const { selectedFolderId, setSelectedFolderId } = useSmartNotesStore()
  const { data: folders, isLoading } = useFolders()
  const createMutation = useCreateFolder()
  const deleteMutation = useDeleteFolder()

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await createMutation.mutateAsync({ name: newFolderName.trim() })
    setNewFolderName('')
    setIsDialogOpen(false)
  }

  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">Pastas</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Pasta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* All Notes */}
        <button
          onClick={() => setSelectedFolderId(null)}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
            selectedFolderId === null && 'bg-muted'
          )}
        >
          <Folder className="h-4 w-4" />
          <span>Todas as notas</span>
        </button>

        {/* Folders */}
        {folders?.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            isSelected={selectedFolderId === folder.id}
            onSelect={() => setSelectedFolderId(folder.id)}
            onDelete={() => deleteMutation.mutate(folder.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface FolderItemProps {
  folder: FolderType
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

function FolderItem({ folder, isSelected, onSelect, onDelete }: FolderItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors group',
        isSelected && 'bg-muted'
      )}
    >
      <button onClick={onSelect} className="flex items-center gap-2 flex-1 text-left">
        <span>{folder.icon || '📁'}</span>
        <span className="truncate flex-1">{folder.name}</span>
        <span className="text-xs text-muted-foreground">{folder.noteCount}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
