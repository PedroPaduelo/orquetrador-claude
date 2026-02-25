import { prisma } from '../../lib/prisma.js'
import { safeJsonParse } from '../../lib/safe-json.js'

function parseStep(step: {
  id: string
  name: string
  baseUrl: string
  stepOrder: number
  systemPrompt: string | null
  systemPromptNoteId: string | null
  contextNoteIds: string
  memoryNoteIds: string
  conditions: string
  maxRetries: number
  backend: string
  model: string | null
  mcpServers: { serverId: string }[]
  skills: { skillId: string }[]
  agents: { agentId: string }[]
  rules: { ruleId: string }[]
}) {
  return {
    id: step.id,
    name: step.name,
    baseUrl: step.baseUrl,
    stepOrder: step.stepOrder,
    systemPrompt: step.systemPrompt,
    systemPromptNoteId: step.systemPromptNoteId,
    contextNoteIds: safeJsonParse<string[]>(step.contextNoteIds, []),
    memoryNoteIds: safeJsonParse<string[]>(step.memoryNoteIds, []),
    conditions: safeJsonParse<unknown>(step.conditions, { rules: [], default: 'next' }),
    maxRetries: step.maxRetries,
    backend: step.backend,
    model: step.model,
    mcpServerIds: step.mcpServers.map((s) => s.serverId),
    skillIds: step.skills.map((s) => s.skillId),
    agentIds: step.agents.map((s) => s.agentId),
    ruleIds: step.rules.map((s) => s.ruleId),
  }
}

export const workflowsRepository = {
  async findAll(userId: string) {
    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            steps: true,
            conversations: true,
          },
        },
      },
    })

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      type: w.type,
      stepsCount: w._count.steps,
      conversationsCount: w._count.conversations,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }))
  },

  async findById(id: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            mcpServers: true,
            skills: true,
            agents: true,
            rules: true,
          },
        },
      },
    })

    if (!workflow) return null

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      type: workflow.type,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      steps: workflow.steps.map(parseStep),
    }
  },

  async findByIdRaw(id: string) {
    return prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            mcpServers: true,
            skills: true,
            agents: true,
            rules: true,
          },
        },
      },
    })
  },

  async create(input: {
    name: string
    description?: string | null
    type?: string
    steps?: Array<{
      name: string
      baseUrl?: string
      systemPrompt?: string | null
      systemPromptNoteId?: string | null
      contextNoteIds?: string[]
      memoryNoteIds?: string[]
      conditions?: unknown
      maxRetries?: number
      backend?: string
      model?: string | null
      mcpServerIds?: string[]
      skillIds?: string[]
      agentIds?: string[]
      ruleIds?: string[]
    }>
  }, userId: string) {
    const workflow = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        type: input.type ?? 'sequential',
        userId,
        steps: input.steps
          ? {
              create: input.steps.map((step, index) => ({
                name: step.name,
                baseUrl: step.baseUrl ?? '',
                stepOrder: index,
                systemPrompt: step.systemPrompt,
                systemPromptNoteId: step.systemPromptNoteId,
                contextNoteIds: JSON.stringify(step.contextNoteIds ?? []),
                memoryNoteIds: JSON.stringify(step.memoryNoteIds ?? []),
                conditions: JSON.stringify(step.conditions ?? { rules: [], default: 'next' }),
                maxRetries: step.maxRetries ?? 0,
                backend: step.backend ?? 'claude',
                model: step.model,
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
              })),
            }
          : undefined,
      },
    })

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      type: workflow.type,
      createdAt: workflow.createdAt.toISOString(),
    }
  },

  async update(
    id: string,
    input: {
      name?: string
      description?: string | null
      type?: string
      steps?: Array<{
        id?: string
        name: string
        baseUrl?: string
        systemPrompt?: string | null
        systemPromptNoteId?: string | null
        contextNoteIds?: string[]
        memoryNoteIds?: string[]
        conditions?: unknown
        maxRetries?: number
        backend?: string
        model?: string | null
        mcpServerIds?: string[]
        skillIds?: string[]
        agentIds?: string[]
        ruleIds?: string[]
      }>
    },
  ) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.type !== undefined) data.type = input.type

    if (input.steps !== undefined) {
      // Get all step IDs for this workflow to delete join tables
      const existingSteps = await prisma.workflowStep.findMany({
        where: { workflowId: id },
        select: { id: true },
      })
      const stepIds = existingSteps.map((s) => s.id)

      if (stepIds.length > 0) {
        await prisma.workflowStepMcpServer.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepSkill.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepAgent.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepRule.deleteMany({ where: { stepId: { in: stepIds } } })
      }

      await prisma.workflowStep.deleteMany({ where: { workflowId: id } })

      data.steps = {
        create: input.steps.map((step, index) => ({
          name: step.name,
          baseUrl: step.baseUrl ?? '',
          stepOrder: index,
          systemPrompt: step.systemPrompt,
          systemPromptNoteId: step.systemPromptNoteId,
          contextNoteIds: JSON.stringify(step.contextNoteIds ?? []),
          memoryNoteIds: JSON.stringify(step.memoryNoteIds ?? []),
          conditions: JSON.stringify(step.conditions ?? { rules: [], default: 'next' }),
          maxRetries: step.maxRetries ?? 0,
          backend: step.backend ?? 'claude',
          model: step.model,
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
        })),
      }
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: data as Parameters<typeof prisma.workflow.update>[0]['data'],
    })

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      type: workflow.type,
      updatedAt: workflow.updatedAt.toISOString(),
    }
  },

  async delete(id: string) {
    await prisma.workflow.delete({ where: { id } })
  },
}
