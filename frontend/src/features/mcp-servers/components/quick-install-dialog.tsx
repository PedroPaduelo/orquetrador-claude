import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { useQuickInstallMcpServer } from '../hooks/use-mcp-servers'

const formSchema = z.object({
  command: z.string().min(1, 'Comando obrigatorio'),
  name: z.string().optional(),
  envVarsStr: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface QuickInstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickInstallDialog({ open, onOpenChange }: QuickInstallDialogProps) {
  const installMutation = useQuickInstallMcpServer()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      command: '',
      name: '',
      envVarsStr: '',
    },
  })

  const onSubmit = (data: FormData) => {
    const envVars: Record<string, string> = {}
    if (data.envVarsStr) {
      data.envVarsStr.split('\n').forEach((line) => {
        const [key, ...rest] = line.split('=')
        if (key && rest.length > 0) {
          envVars[key.trim()] = rest.join('=').trim()
        }
      })
    }

    installMutation.mutate(
      {
        command: data.command,
        name: data.name || undefined,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Instalar MCP Server</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="mcp-command">Comando</Label>
            <Input
              id="mcp-command"
              {...register('command')}
              placeholder="npx -y @modelcontextprotocol/server-filesystem /path"
              className="font-mono text-sm"
            />
            {errors.command && <p className="text-sm text-destructive mt-1">{errors.command.message}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Cole o comando como voce rodaria no terminal. Exemplos:
            </p>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5 font-mono">
              <p>npx -y @modelcontextprotocol/server-filesystem /allowed/path</p>
              <p>npx -y @modelcontextprotocol/server-github</p>
              <p>uvx mcp-server-sqlite --db-path /tmp/test.db</p>
              <p>docker run -i mcp/fetch</p>
            </div>
          </div>

          <div>
            <Label htmlFor="mcp-name">Nome (opcional)</Label>
            <Input
              id="mcp-name"
              {...register('name')}
              placeholder="Detectado automaticamente do pacote"
            />
          </div>

          <div>
            <Label htmlFor="mcp-env">Variaveis de Ambiente (opcional, KEY=VALUE por linha)</Label>
            <Textarea
              id="mcp-env"
              {...register('envVarsStr')}
              placeholder="GITHUB_TOKEN=ghp_xxx"
              rows={2}
              className="font-mono text-sm"
            />
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
      </DialogContent>
    </Dialog>
  )
}
