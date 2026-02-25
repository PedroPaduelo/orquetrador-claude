import { useEffect, useState } from 'react'
import { Terminal, MessageSquare, Bot, Info } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { Slider } from '@/shared/components/ui/slider'
import { useHooksStore } from '../store'
import { useCreateHook, useUpdateHook, useHookEvents } from '../hooks/use-hooks'
import type { HookInput, HookEventInfo } from '../types'

const HANDLER_OPTIONS = [
  { value: 'command', label: 'Comando Shell', icon: Terminal, description: 'Executa um comando no terminal' },
  { value: 'prompt', label: 'Prompt LLM', icon: MessageSquare, description: 'Envia prompt para o Claude decidir' },
  { value: 'agent', label: 'Subagente', icon: Bot, description: 'Inicia um subagente com ferramentas' },
]

const EVENT_CATEGORIES = {
  tools: { label: 'Ferramentas', color: 'text-blue-500' },
  lifecycle: { label: 'Ciclo de Vida', color: 'text-emerald-500' },
  workflow: { label: 'Workflow', color: 'text-purple-500' },
  system: { label: 'Sistema', color: 'text-amber-500' },
}

export function HookForm() {
  const { editingHook } = useHooksStore()
  const createMutation = useCreateHook()
  const updateMutation = useUpdateHook()
  const { data: events } = useHookEvents()

  const [form, setForm] = useState<HookInput>({
    name: '',
    description: '',
    eventType: 'PreToolUse',
    matcher: null,
    handlerType: 'command',
    command: '',
    prompt: '',
    timeout: 60000,
    isAsync: false,
    statusMessage: '',
    enabled: true,
    isGlobal: true,
  })

  useEffect(() => {
    if (editingHook) {
      setForm({
        name: editingHook.name,
        description: editingHook.description || '',
        eventType: editingHook.eventType,
        matcher: editingHook.matcher,
        handlerType: editingHook.handlerType,
        command: editingHook.command || '',
        prompt: editingHook.prompt || '',
        timeout: editingHook.timeout,
        isAsync: editingHook.isAsync,
        statusMessage: editingHook.statusMessage || '',
        enabled: editingHook.enabled,
        isGlobal: editingHook.isGlobal,
      })
    }
  }, [editingHook])

  const selectedEvent = events?.find(e => e.value === form.eventType)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: HookInput = {
      ...form,
      matcher: form.matcher || null,
      command: form.handlerType === 'command' ? (form.command || null) : null,
      prompt: form.handlerType !== 'command' ? (form.prompt || null) : null,
      statusMessage: form.statusMessage || null,
    }

    if (editingHook) {
      updateMutation.mutate({ id: editingHook.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // Group events by category
  const groupedEvents = events?.reduce((acc, event) => {
    const cat = event.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(event)
    return acc
  }, {} as Record<string, HookEventInfo[]>)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Ex: Bloquear rm -rf"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descricao</Label>
        <Input
          id="description"
          value={form.description || ''}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Breve descricao do que este hook faz"
        />
      </div>

      {/* Event Type - Visual selector */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label>Evento</Label>
          {selectedEvent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[300px]">
                  <p className="text-xs">{selectedEvent.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Select
          value={form.eventType}
          onValueChange={(v) => setForm(f => ({ ...f, eventType: v, matcher: null }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {groupedEvents && Object.entries(groupedEvents).map(([cat, evts]) => (
              <div key={cat}>
                <div className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${EVENT_CATEGORIES[cat as keyof typeof EVENT_CATEGORIES]?.color || 'text-muted-foreground'}`}>
                  {EVENT_CATEGORIES[cat as keyof typeof EVENT_CATEGORIES]?.label || cat}
                </div>
                {evts.map(evt => (
                  <SelectItem key={evt.value} value={evt.value}>
                    <div className="flex flex-col">
                      <span>{evt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{evt.description.slice(0, 60)}...</span>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        {selectedEvent && (
          <p className="text-[11px] text-muted-foreground mt-1">{selectedEvent.description}</p>
        )}
      </div>

      {/* Matcher */}
      {selectedEvent?.supportsMatcher && (
        <div className="space-y-1.5">
          <Label htmlFor="matcher">{selectedEvent.matcherLabel || 'Matcher'}</Label>
          <Input
            id="matcher"
            value={form.matcher || ''}
            onChange={(e) => setForm(f => ({ ...f, matcher: e.target.value || null }))}
            placeholder={selectedEvent.matcherHint || 'Regex pattern'}
            className="font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Regex. Deixe vazio para aplicar a todos.</p>
        </div>
      )}

      {/* Handler Type - Visual cards */}
      <div className="space-y-1.5">
        <Label>Tipo de Handler</Label>
        <div className="grid grid-cols-3 gap-2">
          {HANDLER_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isSelected = form.handlerType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, handlerType: opt.value as HookInput['handlerType'] }))}
                className={`
                  flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-[11px] font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Command (for command handler) */}
      {form.handlerType === 'command' && (
        <div className="space-y-1.5">
          <Label htmlFor="command">Comando</Label>
          <Textarea
            id="command"
            value={form.command || ''}
            onChange={(e) => setForm(f => ({ ...f, command: e.target.value }))}
            placeholder="Ex: npx eslint --fix $TOOL_INPUT_FILE_PATH"
            className="font-mono text-sm min-h-[80px]"
          />
          <p className="text-[10px] text-muted-foreground">
            Variaveis disponiveis: $TOOL_NAME, $TOOL_INPUT, $TOOL_INPUT_FILE_PATH, $SESSION_ID
          </p>
        </div>
      )}

      {/* Prompt (for prompt/agent handler) */}
      {form.handlerType !== 'command' && (
        <div className="space-y-1.5">
          <Label htmlFor="prompt">
            {form.handlerType === 'prompt' ? 'Prompt de Decisao' : 'Instrucoes do Agente'}
          </Label>
          <Textarea
            id="prompt"
            value={form.prompt || ''}
            onChange={(e) => setForm(f => ({ ...f, prompt: e.target.value }))}
            placeholder={
              form.handlerType === 'prompt'
                ? 'O Claude vai avaliar e decidir sim/nao...'
                : 'Instrucoes para o subagente executar...'
            }
            className="min-h-[100px]"
          />
        </div>
      )}

      {/* Status Message */}
      <div className="space-y-1.5">
        <Label htmlFor="statusMessage">Mensagem de Status</Label>
        <Input
          id="statusMessage"
          value={form.statusMessage || ''}
          onChange={(e) => setForm(f => ({ ...f, statusMessage: e.target.value }))}
          placeholder="Ex: Verificando seguranca..."
        />
        <p className="text-[10px] text-muted-foreground">Exibida enquanto o hook executa</p>
      </div>

      {/* Timeout slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Timeout</Label>
          <span className="text-xs text-muted-foreground font-mono">{(form.timeout! / 1000)}s</span>
        </div>
        <Slider
          value={[form.timeout! / 1000]}
          onValueChange={([v]) => setForm(f => ({ ...f, timeout: v * 1000 }))}
          min={1}
          max={120}
          step={1}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1s</span>
          <span>120s</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Assincrono</Label>
            <p className="text-[10px] text-muted-foreground">Executa sem bloquear o fluxo</p>
          </div>
          <Switch
            checked={form.isAsync}
            onCheckedChange={(v) => setForm(f => ({ ...f, isAsync: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Global</Label>
            <p className="text-[10px] text-muted-foreground">Aplica em todos os projetos</p>
          </div>
          <Switch
            checked={form.isGlobal}
            onCheckedChange={(v) => setForm(f => ({ ...f, isGlobal: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Ativo</Label>
            <p className="text-[10px] text-muted-foreground">Hook habilitado para execucao</p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending || !form.name || !form.eventType}>
          {isPending ? 'Salvando...' : editingHook ? 'Salvar' : 'Criar Hook'}
        </Button>
      </div>
    </form>
  )
}
