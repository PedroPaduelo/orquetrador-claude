import { Server, Sparkles, Bot, ScrollText, Webhook } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ResourceSelectPanel } from './resource-select-panel'
import { useMcpServers } from '@/features/mcp-servers/hooks/use-mcp-servers'
import { useSkills } from '@/features/skills/hooks/use-skills'
import { useAgents } from '@/features/agents/hooks/use-agents'
import { useRules } from '@/features/rules/hooks/use-rules'
import { useHooks } from '@/features/hooks/hooks/use-hooks'
import { useWorkflowsStore } from '../../store'
import { cn } from '@/shared/lib/utils'

const tabs = [
  { value: 'mcp', label: 'MCP', icon: Server, field: 'mcpServerIds' as const },
  { value: 'skills', label: 'Skills', icon: Sparkles, field: 'skillIds' as const },
  { value: 'agents', label: 'Agents', icon: Bot, field: 'agentIds' as const },
  { value: 'rules', label: 'Rules', icon: ScrollText, field: 'ruleIds' as const },
  { value: 'hooks', label: 'Hooks', icon: Webhook, field: 'hookIds' as const },
] as const

export function StepResourceTabs() {
  const { formSteps, selectedStepIndex, updateStep } = useWorkflowsStore()
  const step = formSteps[selectedStepIndex]

  const { data: mcpServers } = useMcpServers()
  const { data: skills } = useSkills()
  const { data: agents } = useAgents()
  const { data: rules } = useRules()
  const { data: hooks } = useHooks()

  if (!step) return null

  const handleToggle = (
    field: 'mcpServerIds' | 'skillIds' | 'agentIds' | 'ruleIds' | 'hookIds',
    id: string,
    checked: boolean
  ) => {
    const current = step[field]
    const updated = checked
      ? [...current, id]
      : current.filter((x) => x !== id)
    updateStep(selectedStepIndex, { [field]: updated })
  }

  const handleClear = (field: 'mcpServerIds' | 'skillIds' | 'agentIds' | 'ruleIds' | 'hookIds') => {
    updateStep(selectedStepIndex, { [field]: [] })
  }

  const dataMap = {
    mcp: mcpServers,
    skills: skills,
    agents: agents,
    rules: rules,
    hooks: hooks,
  } as const

  const placeholders = {
    mcp: { empty: 'Nenhum servidor MCP disponivel', search: 'Buscar MCP...' },
    skills: { empty: 'Nenhuma skill disponivel', search: 'Buscar skills...' },
    agents: { empty: 'Nenhum agent disponivel', search: 'Buscar agents...' },
    rules: { empty: 'Nenhuma rule disponivel', search: 'Buscar rules...' },
    hooks: { empty: 'Nenhum hook disponivel', search: 'Buscar hooks...' },
  } as const

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Recursos</h4>
      <Tabs defaultValue="mcp" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-9 p-0.5">
          {tabs.map((tab) => {
            const count = step[tab.field].length
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-[11px] gap-1 px-1 py-1.5 data-[state=active]:shadow-sm"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-medium px-1',
                    'bg-primary/15 text-primary'
                  )}>
                    {count}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-2">
            <ResourceSelectPanel
              items={dataMap[tab.value]}
              selectedIds={step[tab.field]}
              onToggle={(id, checked) => handleToggle(tab.field, id, checked)}
              onClear={() => handleClear(tab.field)}
              emptyMessage={placeholders[tab.value].empty}
              searchPlaceholder={placeholders[tab.value].search}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
