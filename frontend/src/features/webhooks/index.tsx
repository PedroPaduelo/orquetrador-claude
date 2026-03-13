import { useState } from 'react'
import {
  Webhook,
  Plus,
  Trash2,
  Pencil,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
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
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useToggleWebhook,
  useWebhookDeliveries,
} from './hooks/use-webhooks'
import type { Webhook as WebhookType, WebhookInput } from './api'

const ALL_EVENTS = [
  'conversation.created',
  'conversation.completed',
  'step.started',
  'step.completed',
  'step.error',
  'workflow.created',
  'workflow.updated',
  'workflow.deleted',
]

export default function WebhooksPage() {
  const { data: webhooks, isLoading } = useWebhooks()
  const createMutation = useCreateWebhook()
  const updateMutation = useUpdateWebhook()
  const deleteMutation = useDeleteWebhook()
  const toggleMutation = useToggleWebhook()

  const [editDialog, setEditDialog] = useState<{
    open: boolean
    webhook: WebhookType | null
  }>({ open: false, webhook: null })

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    webhook: WebhookType | null
  }>({ open: false, webhook: null })

  const [deliveriesDialog, setDeliveriesDialog] = useState<{
    open: boolean
    webhookId: string | null
  }>({ open: false, webhookId: null })

  const [formData, setFormData] = useState<WebhookInput>({
    url: '',
    events: [],
    secret: '',
    enabled: true,
  })

  const openCreate = () => {
    setFormData({ url: '', events: [], secret: '', enabled: true })
    setEditDialog({ open: true, webhook: null })
  }

  const openEdit = (webhook: WebhookType) => {
    setFormData({
      url: webhook.url,
      events: webhook.events,
      secret: '',
      enabled: webhook.enabled,
    })
    setEditDialog({ open: true, webhook })
  }

  const handleSave = () => {
    if (editDialog.webhook) {
      updateMutation.mutate(
        { id: editDialog.webhook.id, input: formData },
        { onSuccess: () => setEditDialog({ open: false, webhook: null }) }
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => setEditDialog({ open: false, webhook: null }),
      })
    }
  }

  const handleDelete = () => {
    if (deleteDialog.webhook) {
      deleteMutation.mutate(deleteDialog.webhook.id)
      setDeleteDialog({ open: false, webhook: null })
    }
  }

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" />
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure notificacoes HTTP para eventos do sistema
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="Nenhum Webhook"
          description="Webhooks enviam notificacoes HTTP quando eventos ocorrem no sistema."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Webhook
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook, index) => (
            <Card
              key={webhook.id}
              className={`animate-fade-in-up ${!webhook.enabled ? 'opacity-60' : ''}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium font-mono truncate">
                        {webhook.url}
                      </p>
                      <Badge
                        variant={webhook.enabled ? 'default' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {webhook.enabled ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {webhook.deliveryCount} entregas
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setDeliveriesDialog({ open: true, webhookId: webhook.id })
                      }
                      title="Ver entregas"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleMutation.mutate(webhook.id)}
                      title={webhook.enabled ? 'Desativar' : 'Ativar'}
                    >
                      {webhook.enabled ? (
                        <ToggleRight className="h-3.5 w-3.5" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(webhook)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, webhook })}
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
        onOpenChange={(open) => setEditDialog({ open, webhook: open ? editDialog.webhook : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog.webhook ? 'Editar Webhook' : 'Criar Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure a URL e os eventos que ativam este webhook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <Label>Secret (opcional)</Label>
              <Input
                value={formData.secret || ''}
                onChange={(e) => setFormData((p) => ({ ...p, secret: e.target.value }))}
                placeholder="Assinatura HMAC"
                type="password"
              />
            </div>
            <div>
              <Label className="mb-2 block">Eventos</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((event) => (
                  <Badge
                    key={event}
                    variant={formData.events.includes(event) ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleEvent(event)}
                  >
                    {event}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, enabled: checked }))
                }
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, webhook: null })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.url ||
                formData.events.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editDialog.webhook ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries Dialog */}
      <DeliveriesViewer
        open={deliveriesDialog.open}
        onOpenChange={(open) =>
          setDeliveriesDialog({ open, webhookId: open ? deliveriesDialog.webhookId : null })
        }
        webhookId={deliveriesDialog.webhookId}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, webhook: null })}
        title="Excluir Webhook"
        description={`Tem certeza que deseja excluir o webhook "${deleteDialog.webhook?.url}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}

function DeliveriesViewer({
  open,
  onOpenChange,
  webhookId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhookId: string | null
}) {
  const { data: deliveries, isLoading } = useWebhookDeliveries(
    open ? (webhookId ?? undefined) : undefined
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Entregas do Webhook</DialogTitle>
          <DialogDescription>
            Historico de entregas recentes deste webhook.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma entrega registrada
            </p>
          ) : (
            deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm"
              >
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    delivery.success ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {delivery.event}
                    </Badge>
                    {delivery.statusCode && (
                      <span className="text-xs text-muted-foreground">
                        HTTP {delivery.statusCode}
                      </span>
                    )}
                  </div>
                  {delivery.error && (
                    <p className="text-xs text-destructive mt-0.5 truncate">
                      {delivery.error}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(delivery.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
