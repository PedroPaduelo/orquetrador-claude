import { ResourceType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

interface StepResources {
  mcpServerIds?: string[]
  skillIds?: string[]
  agentIds?: string[]
  ruleIds?: string[]
  hookIds?: string[]
}

const RESOURCE_MAP: Array<{ key: keyof StepResources; type: ResourceType }> = [
  { key: 'mcpServerIds', type: 'mcp_server' },
  { key: 'skillIds', type: 'skill' },
  { key: 'agentIds', type: 'agent' },
  { key: 'ruleIds', type: 'rule' },
  { key: 'hookIds', type: 'hook' },
]

export async function syncWorkflowDependencies(workflowId: string, steps: StepResources[]) {
  // Collect all dependency pairs
  const deps: Array<{ depType: ResourceType; depId: string }> = []

  for (const step of steps) {
    for (const { key, type } of RESOURCE_MAP) {
      const ids = step[key]
      if (ids?.length) {
        for (const id of ids) {
          deps.push({ depType: type, depId: id })
        }
      }
    }
  }

  // Deduplicate
  const uniqueKey = (d: { depType: ResourceType; depId: string }) => `${d.depType}:${d.depId}`
  const seen = new Set<string>()
  const uniqueDeps = deps.filter((d) => {
    const k = uniqueKey(d)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Replace all dependencies atomically
  await prisma.$transaction(async (tx) => {
    await tx.resourceDependency.deleteMany({
      where: { sourceType: 'workflow', sourceId: workflowId },
    })

    if (uniqueDeps.length > 0) {
      await tx.resourceDependency.createMany({
        data: uniqueDeps.map((d) => ({
          sourceType: 'workflow' as ResourceType,
          sourceId: workflowId,
          dependencyType: d.depType,
          dependencyId: d.depId,
        })),
        skipDuplicates: true,
      })
    }
  })
}

export async function deleteWorkflowDependencies(workflowId: string) {
  await prisma.resourceDependency.deleteMany({
    where: { sourceType: 'workflow', sourceId: workflowId },
  })
}

export async function getDependencies(sourceType: ResourceType, sourceId: string) {
  return prisma.resourceDependency.findMany({
    where: { sourceType, sourceId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getDependents(dependencyType: ResourceType, dependencyId: string) {
  return prisma.resourceDependency.findMany({
    where: { dependencyType, dependencyId },
    orderBy: { createdAt: 'asc' },
  })
}
