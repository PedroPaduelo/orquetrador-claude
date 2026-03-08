import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, LayoutGrid, Table2, FolderOpen, FolderPlus, Check } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs'
import { EmptyState } from '@/shared/components/common/empty-state'
import { ListSkeleton } from '@/shared/components/common/loading-skeleton'
import {
  useSearchPagination,
  SearchBar,
  FilterBar,
  Pagination,
  type FilterDefinition,
} from '@/shared/components/common/search-pagination'
import { ConversationCard } from './components/conversation-card'
import { ConversationTable } from './components/conversation-table'
import { useConversations, useCreateConversation, useDeleteConversation, useCloneConversation, useFolders } from './hooks/use-conversations'
import { useWorkflows } from '../workflows/hooks/use-workflows'
import { useAuthStore } from '../auth/store'
import type { Conversation } from './types'

const FOLDER_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

const searchFields: (keyof Conversation)[] = ['title', 'workflowName']

export default function ConversationsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const basePath = user?.basePath || ''
  const { data: conversations, isLoading } = useConversations()
  const { data: workflows } = useWorkflows()
  const { data: folders } = useFolders()
  const createMutation = useCreateConversation()
  const deleteMutation = useDeleteConversation()
  const cloneMutation = useCloneConversation()

  const filters = useMemo<FilterDefinition<Conversation>[]>(() => {
    const workflowOptions = (workflows ?? []).map((wf) => ({
      value: wf.id,
      label: wf.name,
    }))

    return [
      {
        key: 'workflow',
        label: 'Workflow',
        options: workflowOptions,
        match: (item, value) => item.workflowId === value,
      },
      {
        key: 'type',
        label: 'Tipo',
        options: [
          { value: 'sequential', label: 'Sequencial' },
          { value: 'step_by_step', label: 'Passo a Passo' },
        ],
        match: (item, value) => item.workflowType === value,
      },
    ]
  }, [workflows])

  const {
    paged,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total,
    activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useSearchPagination({ data: conversations, searchFields, filters })

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('conversations-view') as 'grid' | 'table') || 'grid'
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [folderMode, setFolderMode] = useState<'select' | 'create'>('create')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [newFolderName, setNewFolderName] = useState('')

  const folderNameError = useMemo(() => {
    if (folderMode !== 'create' || !newFolderName) return ''
    if (!FOLDER_NAME_REGEX.test(newFolderName)) return 'Apenas letras, numeros, hifens e underscores'
    if (folders?.some((f) => f.name === newFolderName)) return 'Pasta ja existe'
    return ''
  }, [folderMode, newFolderName, folders])

  const folderName = folderMode === 'create' ? newFolderName.trim() : selectedFolder
  const projectPath = folderName ? `${basePath}/${folderName}` : ''
  const canCreate = selectedWorkflowId && folderName && !folderNameError && (folderMode === 'select' || (folderMode === 'create' && FOLDER_NAME_REGEX.test(newFolderName)))

  const handleCreate = async () => {
    if (!canCreate) return

    const result = await createMutation.mutateAsync({
      workflowId: selectedWorkflowId,
      title: newTitle || undefined,
      projectPath,
    })

    setIsDialogOpen(false)
    setSelectedWorkflowId('')
    setNewTitle('')
    setNewFolderName('')
    setSelectedFolder('')
    setFolderMode('create')
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
                <Label>Titulo (opcional)</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Analise do projeto X"
                />
              </div>

              <div className="space-y-2">
                <Label>Pasta do Projeto</Label>
                <Tabs value={folderMode} onValueChange={(v) => setFolderMode(v as 'select' | 'create')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="create" className="flex-1 gap-1.5">
                      <FolderPlus className="h-3.5 w-3.5" />
                      Criar nova
                    </TabsTrigger>
                    <TabsTrigger value="select" className="flex-1 gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      Selecionar existente
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="space-y-2">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="nome-do-projeto"
                    />
                    {folderNameError && (
                      <p className="text-xs text-destructive">{folderNameError}</p>
                    )}
                    {newFolderName && !folderNameError && (
                      <p className="text-xs text-muted-foreground">
                        {basePath}/{newFolderName}
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="select">
                    {folders && folders.length > 0 ? (
                      <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                        {folders.map((folder) => (
                          <button
                            key={folder.path}
                            type="button"
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors ${
                              selectedFolder === folder.name
                                ? 'bg-primary/5 border-l-2 border-l-primary'
                                : ''
                            }`}
                            onClick={() => setSelectedFolder(folder.name)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {selectedFolder === folder.name ? (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate">{folder.name}</span>
                            </div>
                            {folder.conversationsCount > 0 && (
                              <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                                {folder.conversationsCount}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma pasta existente. Crie uma nova.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!canCreate || createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {isLoading ? (
        <ListSkeleton count={6} />
      ) : conversations && conversations.length > 0 ? (
        <>
          {/* Search + View Toggle */}
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar conversas..."
              total={total}
            />
            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('grid'); localStorage.setItem('conversations-view', 'grid') }}
                title="Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => { setViewMode('table'); localStorage.setItem('conversations-view', 'table') }}
                title="Tabela"
              >
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActive={hasActiveFilters}
          />

          {/* Grid / Table */}
          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paged.map((conversation, index) => (
                <div
                  key={conversation.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ConversationCard
                    conversation={conversation}
                    onDelete={() => deleteMutation.mutate(conversation.id)}
                    onClone={() => cloneMutation.mutate(conversation.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <ConversationTable
              conversations={paged}
              onDelete={(conv) => deleteMutation.mutate(conv.id)}
              onClone={(conv) => cloneMutation.mutate(conv.id)}
            />
          )}

          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma conversa ainda"
          description="Selecione um workflow e inicie sua primeira conversa com o Claude."
          action={
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conversa
            </Button>
          }
        />
      )}
    </div>
  )
}
