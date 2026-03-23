import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

type SnapshotStep = {
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

type Snapshot = {
  name: string
  description: string | null
  type: string
  steps: SnapshotStep[]
}

function buildSnapshot(workflow: {
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

function computeDiff(prev: Snapshot, curr: Snapshot) {
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

async function fetchWorkflow(workflowId: string) {
  return prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: { mcpServers: true, skills: true, agents: true, rules: true, hooks: true },
      },
    },
  })
}

export const workflowVersioningService = {
  async createVersion(workflowId: string, changelog?: string) {
    const workflow = await fetchWorkflow(workflowId)
    if (!workflow) return null

    const snapshot = buildSnapshot(workflow)

    const lastVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (lastVersion?.version ?? 0) + 1

    let diff: { added: string[]; removed: string[]; modified: string[] } | null = null
    if (lastVersion) {
      const prevSnapshot = lastVersion.snapshot as unknown as Snapshot
      diff = computeDiff(prevSnapshot, snapshot)
    }

    return prisma.workflowVersion.create({
      data: {
        workflowId,
        version: nextVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        diff: diff as unknown as Prisma.InputJsonValue,
        changelog: changelog ?? null,
      },
    })
  },

  async listVersions(workflowId: string) {
    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, changelog: true, diff: true, createdAt: true },
    })
    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      changelog: v.changelog,
      diff: v.diff,
      createdAt: v.createdAt.toISOString(),
    }))
  },

  async getVersion(workflowId: string, version: number) {
    const v = await prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId, version } },
    })
    if (!v) return null
    return {
      id: v.id,
      version: v.version,
      snapshot: v.snapshot,
      diff: v.diff,
      changelog: v.changelog,
      createdAt: v.createdAt.toISOString(),
    }
  },

  async rollback(workflowId: string, targetVersion: number) {
    const target = await prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId, version: targetVersion } },
    })
    if (!target) return null

    const snapshot = target.snapshot as unknown as Snapshot

    const existingSteps = await prisma.workflowStep.findMany({
      where: { workflowId },
      select: { id: true },
    })
    const stepIds = existingSteps.map((s) => s.id)

    if (stepIds.length > 0) {
      await prisma.workflowStepMcpServer.deleteMany({ where: { stepId: { in: stepIds } } })
      await prisma.workflowStepSkill.deleteMany({ where: { stepId: { in: stepIds } } })
      await prisma.workflowStepAgent.deleteMany({ where: { stepId: { in: stepIds } } })
      await prisma.workflowStepRule.deleteMany({ where: { stepId: { in: stepIds } } })
      await prisma.workflowStepHook.deleteMany({ where: { stepId: { in: stepIds } } })
    }
    await prisma.workflowStep.deleteMany({ where: { workflowId } })

    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: snapshot.name,
        description: snapshot.description,
        type: snapshot.type,
        steps: {
          create: snapshot.steps.map((step) => ({
            name: step.name,
            baseUrl: step.baseUrl,
            stepOrder: step.stepOrder,
            systemPrompt: step.systemPrompt,
            useBasePrompt: step.useBasePrompt,
            conditions: (step.conditions ?? { rules: [], default: 'next' }) as Prisma.InputJsonValue,
            maxRetries: step.maxRetries,
            backend: step.backend,
            model: step.model,
            dependsOn: (step.dependsOn ?? []) as Prisma.InputJsonValue,
            validators: (step.validators ?? []) as Prisma.InputJsonValue,
            outputVariables: (step.outputVariables ?? []) as Prisma.InputJsonValue,
            inputVariables: (step.inputVariables ?? []) as Prisma.InputJsonValue,
            mcpServers: step.mcpServerIds?.length
              ? { create: step.mcpServerIds.map((serverId) => ({ serverId })) }
              : undefined,
            skills: step.skillIds?.length
              ? { create: step.skillIds.map((skillId) => ({ skillId })) }
              : undefined,
            agents: step.agentIds?.length
              ? { create: step.agentIds.map((agentId) => ({ agentId })) }
              : undefined,
            rules: step.ruleIds?.length
              ? { create: step.ruleIds.map((ruleId) => ({ ruleId })) }
              : undefined,
            hooks: step.hookIds?.length
              ? { create: step.hookIds.map((hookId) => ({ hookId })) }
              : undefined,
          })),
        },
      },
    })

    const newVersion = await this.createVersion(workflowId, `Rollback para versão ${targetVersion}`)
    return newVersion
  },
}
