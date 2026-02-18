import { useEffect } from 'react'
import { StickyNote, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { FolderList } from './components/folder-list'
import { NotesList } from './components/notes-list'
import { NoteViewer } from './components/note-viewer'
import { useSmartNotesStatus } from './hooks/use-smart-notes'
import { useSmartNotesStore } from './store'

export default function SmartNotesPage() {
  const { data: status, isLoading, error, refetch } = useSmartNotesStatus()
  const { reset } = useSmartNotesStore()

  // Reset store on unmount
  useEffect(() => {
    return () => reset()
  }, [reset])

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          <Skeleton className="col-span-2 h-full rounded-xl" />
          <Skeleton className="col-span-4 h-full rounded-xl" />
          <Skeleton className="col-span-6 h-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !status?.connected) {
    return (
      <div className="container py-8 page-enter">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Smart Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas notas com integração MCP
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Conexão não estabelecida</AlertTitle>
          <AlertDescription className="mt-2">
            {status?.error || 'Não foi possível conectar ao servidor Smart Notes MCP.'}
            <div className="mt-4">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full page-enter">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <StickyNote className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Smart Notes</h1>
              <p className="text-[11px] text-muted-foreground">
                Conectado a {status.serverUrl}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folders Sidebar */}
        <aside className="w-56 border-r border-border/50 bg-card/30">
          <FolderList />
        </aside>

        {/* Notes List */}
        <div className="w-80 border-r border-border/50">
          <NotesList />
        </div>

        {/* Note Viewer */}
        <main className="flex-1">
          <NoteViewer />
        </main>
      </div>
    </div>
  )
}
