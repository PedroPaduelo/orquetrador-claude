import { useState } from 'react'
import { FileText, Plus, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/common/empty-state'
import {
  useStepTemplates,
  useCreateStepTemplate,
  useUpdateStepTemplate,
  useDeleteStepTemplate,
} from './hooks/use-step-templates'
import type { StepTemplate, StepTemplateInput } from './types'

const emptyForm: StepTemplateInput = {
  name: '',
  description: '',
  baseUrl: '',
  systemPrompt: '',
}

export default function StepTemplatesPage() {
  const { data: templates, isLoading } = useStepTemplates()
  const createMutation = useCreateStepTemplate()
  const updateMutation = useUpdateStepTemplate()
  const deleteMutation = useDeleteStepTemplate()

  const [editDialog, setEditDialog] = useState<{
    open: boolean
    template: StepTemplate | null
  }>({ open: false, template: null })

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    template: StepTemplate | null
  }>({ open: false, template: null })

  const [formData, setFormData] = useState<StepTemplateInput>({ ...emptyForm })

  const openCreate = () => {
    setFormData({ ...emptyForm })
    setEditDialog({ open: true, template: null })
  }

  const openEdit = (template: StepTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      baseUrl: template.baseUrl,
      systemPrompt: template.systemPrompt || '',
    })
    setEditDialog({ open: true, template })
  }

  const handleSave = () => {
    if (editDialog.template) {
      updateMutation.mutate(
        { id: editDialog.template.id, input: formData },
        { onSuccess: () => setEditDialog({ open: false, template: null }) }
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => setEditDialog({ open: false, template: null }),
      })
    }
  }

  const handleDelete = () => {
    if (deleteDialog.template) {
      deleteMutation.mutate(deleteDialog.template.id)
      setDeleteDialog({ open: false, template: null })
    }
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Step Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie templates reutilizaveis para steps de workflows
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum Template"
          description="Templates permitem reutilizar configuracoes de steps em diferentes workflows."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {templates.map((template, index) => (
            <Card
              key={template.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {template.name}
                      </p>
                      {template.backend && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {template.backend}
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {template.inputVariables && template.inputVariables.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.inputVariables.length} var. entrada
                        </Badge>
                      )}
                      {template.outputVariables && template.outputVariables.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.outputVariables.length} var. saida
                        </Badge>
                      )}
                      {template.mcpServerIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.mcpServerIds.length} MCP
                        </Badge>
                      )}
                      {template.skillIds.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.skillIds.length} skills
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(template)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, template })}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          setEditDialog({ open, template: open ? editDialog.template : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog.template ? 'Editar Template' : 'Criar Template'}
            </DialogTitle>
            <DialogDescription>
              Configure as propriedades basicas do template de step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do template"
              />
            </div>
            <div>
              <Label>URL Base</Label>
              <Input
                value={formData.baseUrl}
                onChange={(e) => setFormData((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://api.example.com"
              />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Descricao do template"
                rows={2}
              />
            </div>
            <div>
              <Label>System Prompt</Label>
              <Textarea
                value={formData.systemPrompt || ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, systemPrompt: e.target.value }))
                }
                placeholder="Prompt do sistema para o step"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, template: null })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.name ||
                !formData.baseUrl ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editDialog.template ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, template: null })}
        title="Excluir Template"
        description={`Tem certeza que deseja excluir o template "${deleteDialog.template?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
