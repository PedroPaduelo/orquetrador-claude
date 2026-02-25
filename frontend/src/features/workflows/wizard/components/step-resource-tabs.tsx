import { Server, Sparkles, Bot, ScrollText, Webhook } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Badge } from '@/shared/components/ui/badge'
import { ResourceSelectPanel } from './resource-select-panel'
import { useMcpServers } from '@/features/mcp-servers/hooks/use-mcp-servers'
import { useSkills } from '@/features/skills/hooks/use-skills'
import { useAgents } from '@/features/agents/hooks/use-agents'
import { useRules } from '@/features/rules/hooks/use-rules'
import { useHooks } from '@/features/hooks/hooks/use-hooks'
import { useWorkflowsStore } from '../../store'

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

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Recursos</h4>
      <Tabs defaultValue="mcp" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-9">
          <TabsTrigger value="mcp" className="text-xs gap-1.5">
            <Server className="h-3 w-3" />
            MCP
            {step.mcpServerIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                {step.mcpServerIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="skills" className="text-xs gap-1.5">
            <Sparkles className="h-3 w-3" />
            Skills
            {step.skillIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                {step.skillIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-xs gap-1.5">
            <Bot className="h-3 w-3" />
            Agents
            {step.agentIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                {step.agentIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1.5">
            <ScrollText className="h-3 w-3" />
            Rules
            {step.ruleIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                {step.ruleIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hooks" className="text-xs gap-1.5">
            <Webhook className="h-3 w-3" />
            Hooks
            {step.hookIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                {step.hookIds.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcp" className="mt-3">
          <ResourceSelectPanel
            items={mcpServers}
            selectedIds={step.mcpServerIds}
            onToggle={(id, checked) => handleToggle('mcpServerIds', id, checked)}
            onClear={() => handleClear('mcpServerIds')}
            emptyMessage="Nenhum servidor MCP disponivel"
            searchPlaceholder="Buscar servidores MCP..."
          />
        </TabsContent>

        <TabsContent value="skills" className="mt-3">
          <ResourceSelectPanel
            items={skills}
            selectedIds={step.skillIds}
            onToggle={(id, checked) => handleToggle('skillIds', id, checked)}
            onClear={() => handleClear('skillIds')}
            emptyMessage="Nenhuma skill disponivel"
            searchPlaceholder="Buscar skills..."
          />
        </TabsContent>

        <TabsContent value="agents" className="mt-3">
          <ResourceSelectPanel
            items={agents}
            selectedIds={step.agentIds}
            onToggle={(id, checked) => handleToggle('agentIds', id, checked)}
            onClear={() => handleClear('agentIds')}
            emptyMessage="Nenhum agent disponivel"
            searchPlaceholder="Buscar agents..."
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-3">
          <ResourceSelectPanel
            items={rules}
            selectedIds={step.ruleIds}
            onToggle={(id, checked) => handleToggle('ruleIds', id, checked)}
            onClear={() => handleClear('ruleIds')}
            emptyMessage="Nenhuma rule disponivel"
            searchPlaceholder="Buscar rules..."
          />
        </TabsContent>

        <TabsContent value="hooks" className="mt-3">
          <ResourceSelectPanel
            items={hooks}
            selectedIds={step.hookIds}
            onToggle={(id, checked) => handleToggle('hookIds', id, checked)}
            onClear={() => handleClear('hookIds')}
            emptyMessage="Nenhum hook disponivel"
            searchPlaceholder="Buscar hooks..."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
