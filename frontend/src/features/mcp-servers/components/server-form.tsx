import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useMcpServersStore } from '../store'
import { useCreateMcpServer, useUpdateMcpServer } from '../hooks/use-mcp-servers'
import type { McpServerInput } from '../types'

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  description: z.string().optional(),
  type: z.enum(['http', 'sse', 'stdio']),
  uri: z.string().optional(),
  command: z.string().optional(),
  argsStr: z.string().optional(),
  envVarsStr: z.string().optional(),
  isGlobal: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export function ServerForm() {
  const { editingServer, closeModal } = useMcpServersStore()
  const createMutation = useCreateMcpServer()
  const updateMutation = useUpdateMcpServer()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editingServer?.name || '',
      description: editingServer?.description || '',
      type: editingServer?.type || 'http',
      uri: editingServer?.uri || '',
      command: editingServer?.command || '',
      argsStr: editingServer?.args ? editingServer.args.join(', ') : '',
      envVarsStr: editingServer?.envVars ? Object.entries(editingServer.envVars).map(([k, v]) => `${k}=${v}`).join('\n') : '',
      isGlobal: editingServer?.isGlobal ?? true,
    },
  })

  const serverType = watch('type')

  const onSubmit = (data: FormData) => {
    const args = data.argsStr
      ? data.argsStr.split(',').map((a) => a.trim()).filter(Boolean)
      : []

    const envVars: Record<string, string> = {}
    if (data.envVarsStr) {
      data.envVarsStr.split('\n').forEach((line) => {
        const [key, ...rest] = line.split('=')
        if (key && rest.length > 0) {
          envVars[key.trim()] = rest.join('=').trim()
        }
      })
    }

    const input: McpServerInput = {
      name: data.name,
      description: data.description,
      type: data.type,
      uri: data.uri,
      command: data.command,
      args,
      envVars,
      isGlobal: data.isGlobal,
    }

    if (editingServer) {
      updateMutation.mutate({ id: editingServer.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} placeholder="my-mcp-server" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descricao</Label>
        <Textarea id="description" {...register('description')} placeholder="Descricao opcional" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select value={serverType} onValueChange={(v) => setValue('type', v as 'http' | 'sse' | 'stdio')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">HTTP</SelectItem>
              <SelectItem value="sse">SSE</SelectItem>
              <SelectItem value="stdio">Stdio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isGlobal')} className="rounded" />
            <span className="text-sm">Global</span>
          </label>
        </div>
      </div>

      {(serverType === 'http' || serverType === 'sse') && (
        <div>
          <Label htmlFor="uri">URI</Label>
          <Input id="uri" {...register('uri')} placeholder="https://mcp-server.example.com" />
        </div>
      )}

      {serverType === 'stdio' && (
        <>
          <div>
            <Label htmlFor="command">Comando</Label>
            <Input id="command" {...register('command')} placeholder="npx" />
          </div>
          <div>
            <Label htmlFor="argsStr">Argumentos (separados por virgula)</Label>
            <Input id="argsStr" {...register('argsStr')} placeholder="-y, @modelcontextprotocol/server-filesystem" />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="envVarsStr">Variaveis de Ambiente (KEY=VALUE por linha)</Label>
        <Textarea id="envVarsStr" {...register('envVarsStr')} placeholder="API_KEY=xxx" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : editingServer ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}
