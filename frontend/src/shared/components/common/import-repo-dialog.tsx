import { useState } from 'react'
import { GitBranch, Check, AlertCircle, Loader2, Sparkles, Bot, FileText } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { apiClient } from '@/shared/lib/api-client'

interface ImportResult {
  imported: Array<{ type: string; name: string; filesCount: number }>
  skipped: Array<{ type: string; name: string; reason: string }>
  errors: Array<{ path: string; error: string }>
}

interface ImportRepoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectPath?: string
}

const typeLabels: Record<string, string> = {
  skill: 'Skill',
  agent: 'Agent',
  rule: 'Rule',
}

const typeIcons: Record<string, typeof Sparkles> = {
  skill: Sparkles,
  agent: Bot,
  rule: FileText,
}

export function ImportRepoDialog({ open, onOpenChange, defaultProjectPath }: ImportRepoDialogProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [projectPath, setProjectPath] = useState(defaultProjectPath || '')
  const [result, setResult] = useState<ImportResult | null>(null)
  const queryClient = useQueryClient()

  const importMutation = useMutation({
    mutationFn: async (input: { url: string; projectPath: string }) => {
      const { data } = await apiClient.post('/import-repo', input)
      return data as ImportResult
    },
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      if (data.imported.length > 0) {
        toast.success(`${data.imported.length} item(ns) importado(s)!`)
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao importar repositorio')
    },
  })

  const handleImport = () => {
    if (!repoUrl.trim() || !projectPath.trim()) return
    setResult(null)
    importMutation.mutate({ url: repoUrl.trim(), projectPath: projectPath.trim() })
  }

  const handleClose = () => {
    setResult(null)
    setRepoUrl('')
    onOpenChange(false)
  }

  const totalFiles = result?.imported.reduce((sum, i) => sum + i.filesCount, 0) || 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Importar de Repositorio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <>
              <div>
                <Label htmlFor="repo-url">URL do GitHub</Label>
                <Input
                  id="repo-url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/vercel-labs/agent-skills"
                  className="font-mono text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cola a URL do repo. O sistema escaneia e importa skills, agents e rules automaticamente.
                </p>
              </div>

              <div>
                <Label htmlFor="project-path">Caminho do Projeto</Label>
                <Input
                  id="project-path"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/workspace/meu-projeto"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Os arquivos serao copiados pra <code className="text-[10px]">.claude/skills/</code>, <code className="text-[10px]">.claude/agents/</code> e <code className="text-[10px]">.claude/rules/</code> deste projeto.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={!repoUrl.trim() || !projectPath.trim() || importMutation.isPending}>
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    'Importar'
                  )}
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              {result.imported.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {result.imported.length} importado(s) ({totalFiles} arquivos)
                  </p>
                  <div className="space-y-1.5">
                    {result.imported.map((item, i) => {
                      const Icon = typeIcons[item.type] || FileText
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px]">{typeLabels[item.type]}</Badge>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground text-xs">({item.filesCount} arquivos)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    {result.errors.length} erro(s)
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive font-mono truncate">{err.path}: {err.error}</p>
                    ))}
                  </div>
                </div>
              )}

              {result.imported.length === 0 && result.errors.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum skill, agent ou rule encontrado no repositorio.</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Fechar
                </Button>
                <Button onClick={() => { setResult(null); setRepoUrl('') }}>
                  Importar Outro
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
