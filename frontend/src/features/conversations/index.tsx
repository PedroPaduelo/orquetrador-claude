import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, Search, Filter } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ConversationCard } from './components/conversation-card'
import { useConversations, useCreateConversation, useDeleteConversation } from './hooks/use-conversations'
import { useWorkflows } from '../workflows/hooks/use-workflows'

export default function ConversationsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [newTitle, setNewTitle] = useState('')

  const { data: conversations, isLoading } = useConversations()
  const { data: workflows } = useWorkflows()
  const createMutation = useCreateConversation()
  const deleteMutation = useDeleteConversation()

  const filteredConversations = conversations?.filter((conv) => {
    const matchesSearch =
      !search ||
      conv.title?.toLowerCase().includes(search.toLowerCase()) ||
      conv.workflowName?.toLowerCase().includes(search.toLowerCase())

    const matchesWorkflow =
      workflowFilter === 'all' || conv.workflowId === workflowFilter

    return matchesSearch && matchesWorkflow
  })

  const handleCreate = async () => {
    if (!selectedWorkflowId) return

    const result = await createMutation.mutateAsync({
      workflowId: selectedWorkflowId,
      title: newTitle || undefined,
    })

    setIsDialogOpen(false)
    setSelectedWorkflowId('')
    setNewTitle('')
    navigate(`/conversations/${result.id}`)
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suas sessões de trabalho com o Claude
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conversa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conversa</DialogTitle>
              <DialogDescription>
                Selecione um workflow para iniciar uma nova conversa
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Workflow</Label>
                <Select
                  value={selectedWorkflowId}
                  onValueChange={setSelectedWorkflowId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows?.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>
                        {wf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Título (opcional)</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Análise do projeto X"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedWorkflowId || createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-10"
          />
        </div>

        <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os workflows</SelectItem>
            {workflows?.map((wf) => (
              <SelectItem key={wf.id} value={wf.id}>
                {wf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conversations Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredConversations?.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma conversa ainda"
          description={
            search || workflowFilter !== 'all'
              ? 'Nenhum resultado para esses filtros. Tente outra busca.'
              : 'Selecione um workflow e inicie sua primeira conversa com o Claude.'
          }
          action={
            !search && workflowFilter === 'all' ? (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Conversa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConversations?.map((conversation, index) => (
            <div
              key={conversation.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ConversationCard
                conversation={conversation}
                onDelete={() => deleteMutation.mutate(conversation.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
