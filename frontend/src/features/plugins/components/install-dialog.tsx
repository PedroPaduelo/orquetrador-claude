import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useInstallPlugin, useImportPluginUrl } from '../hooks/use-plugins'
import type { PluginManifest } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  manifestJson: z.string().min(1, 'Manifesto obrigatorio'),
})

type FormData = z.infer<typeof formSchema>

interface InstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallDialog({ open, onOpenChange }: InstallDialogProps) {
  const installMutation = useInstallPlugin()
  const importUrlMutation = useImportPluginUrl()
  const [manifestUrl, setManifestUrl] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      version: '',
      author: '',
      manifestJson: '',
    },
  })

  const onSubmitManual = (data: FormData) => {
    let manifest: PluginManifest
    try {
      manifest = JSON.parse(data.manifestJson)
    } catch {
      toast.error('JSON do manifesto invalido')
      return
    }

    installMutation.mutate(
      {
        name: data.name,
        description: data.description,
        version: data.version,
        author: data.author,
        manifest,
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      }
    )
  }

  const handleImportUrl = () => {
    if (!manifestUrl.trim()) return
    importUrlMutation.mutate(manifestUrl.trim(), {
      onSuccess: () => {
        setManifestUrl('')
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Instalar Plugin</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">Via URL</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manifesto Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="plugin-url">URL do manifesto</Label>
              <Input
                id="plugin-url"
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/user/plugin/main/manifest.json"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL publica para um arquivo JSON de manifesto do plugin
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importUrlMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleImportUrl} disabled={!manifestUrl.trim() || importUrlMutation.isPending}>
                {importUrlMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleSubmit(onSubmitManual)} className="space-y-4">
              <div>
                <Label htmlFor="plugin-name">Nome</Label>
                <Input id="plugin-name" {...register('name')} placeholder="meu-plugin" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="plugin-description">Descricao</Label>
                <Input id="plugin-description" {...register('description')} placeholder="Descricao opcional" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plugin-version">Versao</Label>
                  <Input id="plugin-version" {...register('version')} placeholder="1.0.0" />
                </div>
                <div>
                  <Label htmlFor="plugin-author">Autor</Label>
                  <Input id="plugin-author" {...register('author')} placeholder="Nome do autor" />
                </div>
              </div>

              <div>
                <Label htmlFor="plugin-manifest">Manifesto (JSON)</Label>
                <Textarea
                  id="plugin-manifest"
                  {...register('manifestJson')}
                  placeholder='{"mcpServers": [], "skills": [], "agents": []}'
                  rows={10}
                  className="font-mono text-sm"
                />
                {errors.manifestJson && <p className="text-sm text-destructive mt-1">{errors.manifestJson.message}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={installMutation.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={installMutation.isPending}>
                  {installMutation.isPending ? 'Instalando...' : 'Instalar'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
