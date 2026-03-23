import { prisma } from '../../lib/prisma.js'
import { paginate, buildPaginatedResult, type PaginationParams } from '../../lib/pagination.js'
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
    const records = await prisma.gitSource.findMany({ where: { resourceType }, orderBy: { createdAt: 'desc' }, take: 100 })
    return records.map(fromDb)
  },

  async listByTypePaginated(resourceType: ResourceType, pagination: PaginationParams) {
    const where = { resourceType }
    const [records, total] = await Promise.all([
      prisma.gitSource.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(pagination) }),
      prisma.gitSource.count({ where }),
    ])
    return buildPaginatedResult(records.map(fromDb), total, pagination)
  },
}
