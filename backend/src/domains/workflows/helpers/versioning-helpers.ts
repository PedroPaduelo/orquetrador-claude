import { Prisma } from '@prisma/client'

export type SnapshotStep = {
  name: string
  baseUrl: string
  stepOrder: number
  systemPrompt: string | null
  useBasePrompt: boolean
  conditions: unknown
  maxRetries: number
  backend: string
  model: string | null
  dependsOn: unknown
  validators: unknown
  outputVariables: unknown
  inputVariables: unknown
  mcpServerIds: string[]
  skillIds: string[]
  agentIds: string[]
  ruleIds: string[]
  hookIds: string[]
}

export type Snapshot = {
  name: string
  description: string | null
  type: string
  steps: SnapshotStep[]
}

export function buildSnapshot(workflow: {
  name: string
  description: string | null
  type: string
  steps: Array<{
    name: string
    baseUrl: string
    stepOrder: number
    systemPrompt: string | null
    useBasePrompt: boolean
    conditions: Prisma.JsonValue
    maxRetries: number
    backend: string
    model: string | null
    dependsOn: Prisma.JsonValue
    validators: Prisma.JsonValue
    outputVariables: Prisma.JsonValue
    inputVariables: Prisma.JsonValue
    mcpServers: { serverId: string }[]
    skills: { skillId: string }[]
    agents: { agentId: string }[]
    rules: { ruleId: string }[]
    hooks: { hookId: string }[]
  }>
}): Snapshot {
  return {
    name: workflow.name,
    description: workflow.description,
    type: workflow.type,
    steps: workflow.steps.map((s) => ({
      name: s.name,
      baseUrl: s.baseUrl,
      stepOrder: s.stepOrder,
      systemPrompt: s.systemPrompt,
      useBasePrompt: s.useBasePrompt,
      conditions: s.conditions,
      maxRetries: s.maxRetries,
      backend: s.backend,
      model: s.model,
      dependsOn: s.dependsOn,
      validators: s.validators,
      outputVariables: s.outputVariables,
      inputVariables: s.inputVariables,
      mcpServerIds: s.mcpServers.map((m) => m.serverId),
      skillIds: s.skills.map((m) => m.skillId),
      agentIds: s.agents.map((m) => m.agentId),
      ruleIds: s.rules.map((m) => m.ruleId),
      hookIds: s.hooks.map((m) => m.hookId),
    })),
  }
}

export function computeDiff(prev: Snapshot, curr: Snapshot) {
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []

  if (prev.name !== curr.name) modified.push('name')
  if (prev.description !== curr.description) modified.push('description')
  if (prev.type !== curr.type) modified.push('type')

  const prevNames = prev.steps.map((s) => s.name)
  const currNames = curr.steps.map((s) => s.name)

  for (const name of currNames) {
    if (!prevNames.includes(name)) added.push(`step:${name}`)
  }
  for (const name of prevNames) {
    if (!currNames.includes(name)) removed.push(`step:${name}`)
  }

  const stepsChanged = prev.steps.length !== curr.steps.length ||
    JSON.stringify(prev.steps) !== JSON.stringify(curr.steps)
  if (stepsChanged && added.length === 0 && removed.length === 0) {
    modified.push('steps')
  }

  return { added, removed, modified }
}
