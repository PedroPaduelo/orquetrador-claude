import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Separator } from '@/shared/components/ui/separator'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { toast } from 'sonner'
import { promptVersionsApi, type PromptVersion } from '../api-prompt-versions'
import { PromptDiffViewer } from './prompt-diff-viewer'

interface PromptHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  stepId: string
  onRollback?: () => void
}

export function PromptHistoryDialog({
  open,
  onOpenChange,
  workflowId,
  stepId,
  onRollback,
}: PromptHistoryDialogProps) {
  const queryClient = useQueryClient()
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null)

  const { data: versions, isLoading } = useQuery({
    queryKey: ['prompt-versions', workflowId, stepId],
    queryFn: () => promptVersionsApi.list(workflowId, stepId),
    enabled: open && !!workflowId && !!stepId,
  })

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) =>
      promptVersionsApi.rollback(workflowId, stepId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', workflowId, stepId] })
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Rollback realizado com sucesso!')
      onRollback?.()
    },
    onError: () => {
      toast.error('Erro ao realizar rollback')
    },
  })

  const getNextVersion = (version: PromptVersion): PromptVersion | null => {
    if (!versions) return null
    const idx = versions.findIndex((v) => v.id === version.id)
    return idx < versions.length - 1 ? versions[idx + 1] : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historico de Versoes
          </DialogTitle>
          <DialogDescription>
            Veja o historico de alteracoes do prompt do sistema para este step.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !versions || versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma versao encontrada
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                As versoes serao criadas automaticamente ao editar o prompt.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version, index) => (
                <div key={version.id}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'border-primary bg-primary/5'
                        : 'bg-card hover:bg-muted/50'
                    }`}
                    onClick={() =>
                      setSelectedVersion(
                        selectedVersion?.id === version.id ? null : version
                      )
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          v{version.version}
                        </Badge>
                        {index === 0 && (
                          <Badge variant="default" className="text-[10px]">
                            Atual
                          </Badge>
                        )}
                        {version.createdBy && (
                          <span className="text-xs text-muted-foreground">
                            por {version.createdBy}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(version.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {index > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          rollbackMutation.mutate(version.id)
                        }}
                        disabled={rollbackMutation.isPending}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>

                  {selectedVersion?.id === version.id && (
                    <div className="mt-2 mb-2">
                      {(() => {
                        const nextVersion = getNextVersion(version)
                        if (nextVersion) {
                          return (
                            <PromptDiffViewer
                              oldContent={nextVersion.content}
                              newContent={version.content}
                            />
                          )
                        }
                        return (
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                              {version.content}
                            </pre>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {index < versions.length - 1 && (
                    <Separator className="my-1 opacity-30" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
