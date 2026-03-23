import { prisma } from '../../lib/prisma.js'
import type { ResourceType } from '@prisma/client'

function fromDb(record: {
  id: string
  resourceType: ResourceType
  resourceId: string
  repoOwner: string
  repoName: string
  repoBranch: string
  repoPath: string | null
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: record.id,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    repoOwner: record.repoOwner,
    repoName: record.repoName,
    repoBranch: record.repoBranch,
    repoPath: record.repoPath,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const gitSourceRepository = {
  async findByResource(resourceType: ResourceType, resourceId: string) {
    const record = await prisma.gitSource.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } },
    })
    return record ? fromDb(record) : null
  },

  async upsert(data: {
    resourceType: ResourceType
    resourceId: string
    repoOwner: string
    repoName: string
    repoBranch?: string
    repoPath?: string | null
    lastSyncedAt?: Date | null
  }) {
    const { resourceType, resourceId, ...rest } = data
    const record = await prisma.gitSource.upsert({
      where: { resourceType_resourceId: { resourceType, resourceId } },
      create: { resourceType, resourceId, ...rest },
      update: rest,
    })
    return fromDb(record)
  },

  async delete(resourceType: ResourceType, resourceId: string) {
    await prisma.gitSource.deleteMany({
      where: { resourceType, resourceId },
    })
  },

  async listByType(resourceType: ResourceType) {
    const records = await prisma.gitSource.findMany({
      where: { resourceType },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(fromDb)
  },
}
