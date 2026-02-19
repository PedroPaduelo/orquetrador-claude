import { useEffect } from 'react'
import { StickyNote, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { FolderTree } from './components/folder-tree'
import { NoteEditorPane } from './components/note-editor-pane'
import { useSmartNotesStatus } from './hooks/use-smart-notes'
import { useSmartNotesStore } from './store'

export default function SmartNotesPage() {
  const { data: status, isLoading, error, refetch } = useSmartNotesStatus()
  const { reset } = useSmartNotesStore()

  useEffect(() => {
    return () => reset()
  }, [reset])

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="flex gap-4 h-[calc(100vh-200px)]">
          <Skeleton className="w-72 h-full rounded-xl" />
          <Skeleton className="flex-1 h-full rounded-xl" />
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
            {!status?.configured
              ? 'Smart Notes MCP não está configurado. Verifique as variáveis de ambiente.'
              : 'Não foi possível conectar ao servidor Smart Notes MCP.'}
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
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <StickyNote className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Smart Notes</h1>
            <p className="text-[11px] text-muted-foreground">
              Conectado ao Smart Notes MCP
            </p>
          </div>
        </div>
      </header>

      {/* Two-panel layout: sidebar + editor */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-border/50 bg-card/30 flex flex-col shrink-0">
          <FolderTree />
        </aside>
        <main className="flex-1 min-w-0">
          <NoteEditorPane />
        </main>
      </div>
    </div>
  )
}
