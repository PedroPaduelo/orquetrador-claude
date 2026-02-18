import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { usePluginsStore } from '../store'
import { useUpdatePlugin } from '../hooks/use-plugins'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  projectPath: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function PluginForm() {
  const { editingPlugin, isLoadingEdit, closeModal } = usePluginsStore()
  const updateMutation = useUpdatePlugin()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingPlugin?.name || '',
      description: editingPlugin?.description || '',
      version: editingPlugin?.version || '',
      author: editingPlugin?.author || '',
      projectPath: editingPlugin?.projectPath || '',
    },
  })

  useEffect(() => {
    if (editingPlugin && !isLoadingEdit) {
      reset({
        name: editingPlugin.name || '',
        description: editingPlugin.description || '',
        version: editingPlugin.version || '',
        author: editingPlugin.author || '',
        projectPath: editingPlugin.projectPath || '',
      })
    }
  }, [editingPlugin, isLoadingEdit, reset])

  const onSubmit = (data: FormData) => {
    if (!editingPlugin) return
    updateMutation.mutate({
      id: editingPlugin.id,
      input: {
        name: data.name,
        description: data.description || null,
        version: data.version || null,
        author: data.author || null,
        projectPath: data.projectPath || null,
      },
    })
  }

  if (isLoadingEdit) {
    return (
      <div className="space-y-4 py-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Carregando dados do plugin...</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Source info */}
      {editingPlugin?.source === 'imported' && editingPlugin.repoUrl && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Badge variant="default" className="text-[10px]">Importado</Badge>
          <a href={editingPlugin.repoUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline font-mono">
            {editingPlugin.repoUrl}
          </a>
        </div>
      )}

      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} placeholder="meu-plugin" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" {...register('description')} placeholder="Descricao do plugin" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="version">Versao</Label>
          <Input id="version" {...register('version')} placeholder="1.0.0" />
        </div>
        <div>
          <Label htmlFor="author">Autor</Label>
          <Input id="author" {...register('author')} placeholder="Nome" />
        </div>
      </div>

      <div>
        <Label htmlFor="projectPath">Caminho do Projeto</Label>
        <Input id="projectPath" {...register('projectPath')} placeholder="/workspace/projeto" className="font-mono text-sm" />
        <p className="text-xs text-muted-foreground mt-1">Diretorio onde os arquivos do plugin estao instalados</p>
      </div>

      {/* Children summary */}
      {editingPlugin && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recursos do Plugin</p>
          {editingPlugin.skills && editingPlugin.skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Skills ({editingPlugin.skills.length})</p>
              <div className="flex flex-wrap gap-1">
                {editingPlugin.skills.map((s) => (
                  <Badge key={s.id} variant={s.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {editingPlugin.agents && editingPlugin.agents.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Agents ({editingPlugin.agents.length})</p>
              <div className="flex flex-wrap gap-1">
                {editingPlugin.agents.map((a) => (
                  <Badge key={a.id} variant={a.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                    {a.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {editingPlugin.mcpServers && editingPlugin.mcpServers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">MCP Servers ({editingPlugin.mcpServers.length})</p>
              <div className="flex flex-wrap gap-1">
                {editingPlugin.mcpServers.map((m) => (
                  <Badge key={m.id} variant={m.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                    {m.name} ({m.type})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={closeModal} disabled={updateMutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Salvando...' : 'Atualizar'}
        </Button>
      </div>
    </form>
  )
}
