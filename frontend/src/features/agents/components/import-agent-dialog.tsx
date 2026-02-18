import { useState } from 'react'
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
import { useImportAgent } from '../hooks/use-agents'

interface ImportAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportAgentDialog({ open, onOpenChange }: ImportAgentDialogProps) {
  const importMutation = useImportAgent()
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')

  const handleImportUrl = () => {
    if (!url.trim()) return
    importMutation.mutate(
      { url: url.trim() },
      {
        onSuccess: () => {
          setUrl('')
          onOpenChange(false)
        },
      }
    )
  }

  const handleImportContent = () => {
    if (!content.trim()) return
    importMutation.mutate(
      { content: content.trim() },
      {
        onSuccess: () => {
          setContent('')
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Agent</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">Via URL</TabsTrigger>
            <TabsTrigger value="paste" className="flex-1">Colar Conteudo</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="agent-url">URL do agent.md</Label>
              <Input
                id="agent-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/user/repo/main/.claude/agents/my-agent/agent.md"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL publica para um arquivo agent.md com frontmatter YAML
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleImportUrl} disabled={!url.trim() || importMutation.isPending}>
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="agent-content">Conteudo agent.md</Label>
              <Textarea
                id="agent-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`---\nname: meu-agent\ndescription: Descricao do agent\nmodel: claude-sonnet-4-6\ntools:\n  - Read\n  - Write\n---\n\nVoce e um agente especializado em...`}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleImportContent} disabled={!content.trim() || importMutation.isPending}>
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
