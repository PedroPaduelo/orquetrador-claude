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
import { useImportSkill } from '../hooks/use-skills'

interface ImportSkillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportSkillDialog({ open, onOpenChange }: ImportSkillDialogProps) {
  const importMutation = useImportSkill()
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
          <DialogTitle>Importar Skill</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">Via URL</TabsTrigger>
            <TabsTrigger value="paste" className="flex-1">Colar Conteudo</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="skill-url">URL do SKILL.md</Label>
              <Input
                id="skill-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/user/repo/main/.claude/skills/my-skill/SKILL.md"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL publica para um arquivo SKILL.md com frontmatter YAML
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
              <Label htmlFor="skill-content">Conteudo SKILL.md</Label>
              <Textarea
                id="skill-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`---\nname: minha-skill\ndescription: Descricao da skill\nallowed-tools:\n  - Read\n  - Write\n---\n\nInstrucoes da skill aqui...`}
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
