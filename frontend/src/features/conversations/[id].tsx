import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, PanelRightOpen, PanelRightClose } from 'lucide-react'
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
import { StepPanel } from './components/step-panel'
import { useConversation, useDeleteConversation } from './hooks/use-conversations'
import { useConversationsStore } from './store'
import { cn } from '@/shared/lib/utils'

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showStepPanel, setShowStepPanel] = useState(true)
  const { data: conversation, isLoading, error } = useConversation(id!)
  const deleteMutation = useDeleteConversation()
  const { stepStatuses } = useConversationsStore()

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id!)
    navigate('/conversations')
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 flex flex-col">
          <div className="border-b p-4">
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-20 w-3/4" />
            <Skeleton className="h-20 w-1/2 ml-auto" />
            <Skeleton className="h-20 w-3/4" />
          </div>
        </div>
        <div className="w-72 border-l p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
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

  const steps = conversation.workflow?.steps || []
  const currentStepIndex = conversation.currentStepIndex || 0
  const isStreaming = stepStatuses.size > 0 && Array.from(stepStatuses.values()).some(s => s === 'running')

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/conversations')}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="min-w-0">
                <h1 className="font-semibold truncate">
                  {conversation.title || 'Conversa sem titulo'}
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.workflow?.name || 'Workflow desconhecido'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStepPanel(!showStepPanel)}
                title={showStepPanel ? 'Ocultar steps' : 'Mostrar steps'}
              >
                {showStepPanel ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>

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

      {/* Step Panel */}
      <aside
        className={cn(
          'border-l bg-background/50 transition-all duration-300 flex-shrink-0 overflow-hidden',
          showStepPanel ? 'w-72' : 'w-0'
        )}
      >
        {showStepPanel && (
          <StepPanel
            steps={steps}
            currentStepIndex={currentStepIndex}
            isExecuting={isStreaming}
            workflowType={conversation.workflow?.type}
          />
        )}
      </aside>
    </div>
  )
}
