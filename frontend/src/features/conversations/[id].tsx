import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog'
import { ChatContainer } from './components/chat-container'
import { useConversation, useDeleteConversation } from './hooks/use-conversations'

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: conversation, isLoading, error } = useConversation(id!)
  const deleteMutation = useDeleteConversation()

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id!)
    navigate('/conversations')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="h-20 w-1/2 ml-auto" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-xl font-semibold mb-2">Conversa nao encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A conversa solicitada nao existe ou foi removida.
        </p>
        <Button onClick={() => navigate('/conversations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para conversas
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/conversations')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="font-semibold">
                {conversation.title || 'Conversa sem titulo'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {conversation.workflow?.name || 'Workflow desconhecido'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acao nao pode ser desfeita. A conversa e todas as
                    mensagens serao permanentemente removidas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-hidden">
        <ChatContainer conversation={conversation} />
      </main>
    </div>
  )
}
