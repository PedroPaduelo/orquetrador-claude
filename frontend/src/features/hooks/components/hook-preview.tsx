import { useState, useEffect } from 'react'
import { Copy, Check, FileJson } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { useHooksStore } from '../store'
import { hooksApi } from '../api'

export function HookPreviewDialog() {
  const { isPreviewOpen, closePreview } = useHooksStore()
  const [config, setConfig] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isPreviewOpen) {
      setLoading(true)
      hooksApi.preview().then(res => {
        setConfig(res.config)
        setLoading(false)
      }).catch(() => {
        setConfig('// Erro ao gerar preview')
        setLoading(false)
      })
    }
  }, [isPreviewOpen])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isPreviewOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Preview - settings.json
          </DialogTitle>
          <DialogDescription>
            Configuracao gerada para .claude/settings.json com todos os hooks ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-10 h-7 text-xs gap-1"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>

          {loading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 text-xs font-mono overflow-auto max-h-[60vh] leading-relaxed">
              {config || '// Nenhum hook ativo para gerar preview'}
            </pre>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Cole este JSON dentro da chave "hooks" do seu arquivo .claude/settings.json para ativar os hooks no Claude Code.
        </p>
      </DialogContent>
    </Dialog>
  )
}
