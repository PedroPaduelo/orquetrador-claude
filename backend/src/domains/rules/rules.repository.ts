import { prisma } from '../../lib/prisma.js'
import { logAudit } from '../../lib/audit-log.js'
import { paginate, buildPaginatedResult, type PaginationParams } from '../../lib/pagination.js'

function fromDb(record: {
  id: string
  name: string
  description: string | null
  body: string
  enabled: boolean
  isGlobal: boolean
  source: string
  repoUrl: string | null
  repoOwner: string | null
  repoName: string | null
  repoBranch: string | null
  repoPath: string | null
  lastSyncedAt: Date | null
  skillId: string | null
  pluginId: string | null
  createdAt: Date
  updatedAt: Date
  skill?: { name: string } | null
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    body: record.body,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    source: record.source,
    repoUrl: record.repoUrl,
    repoOwner: record.repoOwner,
    repoName: record.repoName,
    repoBranch: record.repoBranch,
    repoPath: record.repoPath,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    skillId: record.skillId,
    skillName: record.skill?.name ?? null,
    pluginId: record.pluginId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const rulesRepository = {
  async findAll(userId: string) {
    const rules = await prisma.rule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { skill: { select: { name: true } } },
      take: 100,
    })
    return rules.map(fromDb)
  },

  async findAllPaginated(userId: string, pagination: PaginationParams) {
    const where = { userId }
    const [rules, total] = await Promise.all([
      prisma.rule.findMany({ where, orderBy: { createdAt: 'desc' }, include: { skill: { select: { name: true } } }, ...paginate(pagination) }),
      prisma.rule.count({ where }),
    ])
    return buildPaginatedResult(rules.map(fromDb), total, pagination)
  },

  async findById(id: string, userId: string) {
    const rule = await prisma.rule.findFirst({
      where: { id, userId },
      include: { skill: { select: { name: true } } },
    })
    return rule ? fromDb(rule) : null
  },

  async findByName(name: string, userId: string) {
    const rule = await prisma.rule.findFirst({ where: { name, userId } })
    return rule ? fromDb(rule) : null
  },

  async create(input: {
    name: string
    description?: string | null
    body?: string
    enabled?: boolean
    isGlobal?: boolean
    skillId?: string | null
    source?: string
    repoUrl?: string | null
    repoOwner?: string | null
    repoName?: string | null
    repoBranch?: string | null
    repoPath?: string | null
    projectPath?: string | null
    lastSyncedAt?: Date | null
  }, userId: string) {
    const rule = await prisma.rule.create({
      data: {
        name: input.name,
        userId,
        description: input.description,
        body: input.body ?? '',
        enabled: input.enabled ?? true,
        isGlobal: input.isGlobal ?? true,
        skillId: input.skillId ?? null,
        source: input.source,
        repoUrl: input.repoUrl,
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        repoBranch: input.repoBranch,
        repoPath: input.repoPath,
        projectPath: input.projectPath,
        lastSyncedAt: input.lastSyncedAt,
      },
    })

    void logAudit({
      userId,
      action: 'create',
      resourceType: 'rule',
      resourceId: rule.id,
      resourceName: rule.name,
      diff: { after: fromDb(rule) },
    })

    return fromDb(rule)
  },

  async update(id: string, userId: string, input: {
    name?: string
    description?: string | null
    body?: string
    enabled?: boolean
    isGlobal?: boolean
    skillId?: string | null
    lastSyncedAt?: Date | null
  }) {
    const before = await prisma.rule.findUnique({ where: { id } })
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.body !== undefined) data.body = input.body
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal
    if (input.skillId !== undefined) data.skillId = input.skillId
    if (input.lastSyncedAt !== undefined) data.lastSyncedAt = input.lastSyncedAt

    const rule = await prisma.rule.update({
      where: { id },
      data: data as Parameters<typeof prisma.rule.update>[0]['data'],
    })

    void logAudit({
      userId,
      action: 'update',
      resourceType: 'rule',
      resourceId: rule.id,
      resourceName: rule.name,
      diff: { before: before ? fromDb(before) : undefined, after: fromDb(rule) },
    })

    return fromDb(rule)
  },

  async delete(id: string, userId: string) {
    const before = await prisma.rule.findUnique({ where: { id } })
    await prisma.rule.deleteMany({ where: { id, userId } })

    if (before) {
      void logAudit({
        userId,
        action: 'delete',
        resourceType: 'rule',
        resourceId: id,
        resourceName: before.name,
        diff: { before: fromDb(before) },
      })
    }
  },

  async toggle(id: string, _userId: string, currentEnabled: boolean) {
    const rule = await prisma.rule.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: rule.id, enabled: rule.enabled }
  },
}
