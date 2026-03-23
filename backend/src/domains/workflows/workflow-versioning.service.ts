import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { buildSnapshot, computeDiff, type Snapshot } from './helpers/versioning-helpers.js'

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

async function deleteStepsAndJoins(workflowId: string) {
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

    await deleteStepsAndJoins(workflowId)

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
