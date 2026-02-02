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
      <div className="container py-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          <Skeleton className="col-span-2 h-full" />
          <Skeleton className="col-span-4 h-full" />
          <Skeleton className="col-span-6 h-full" />
        </div>
      </div>
    )
  }

  if (error || !status?.connected) {
    return (
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Smart Notes</h1>
            <p className="text-muted-foreground">
              Gerencie suas notas com integracao MCP
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Conexao nao estabelecida</AlertTitle>
          <AlertDescription className="mt-2">
            {status?.error || 'Nao foi possivel conectar ao servidor Smart Notes MCP.'}
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StickyNote className="h-6 w-6" />
            <div>
              <h1 className="text-xl font-bold">Smart Notes</h1>
              <p className="text-sm text-muted-foreground">
                Conectado a {status.serverUrl}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folders Sidebar */}
        <aside className="w-56 border-r bg-muted/30">
          <FolderList />
        </aside>

        {/* Notes List */}
        <div className="w-80 border-r">
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
