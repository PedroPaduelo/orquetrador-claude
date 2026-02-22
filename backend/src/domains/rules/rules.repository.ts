import { prisma } from '../../lib/prisma.js'

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
  async findAll() {
    const rules = await prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
      include: { skill: { select: { name: true } } },
    })
    return rules.map(fromDb)
  },

  async findById(id: string) {
    const rule = await prisma.rule.findUnique({
      where: { id },
      include: { skill: { select: { name: true } } },
    })
    return rule ? fromDb(rule) : null
  },

  async findByName(name: string) {
    const rule = await prisma.rule.findUnique({ where: { name } })
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
  }) {
    const rule = await prisma.rule.create({
      data: {
        name: input.name,
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
    return fromDb(rule)
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    body?: string
    enabled?: boolean
    isGlobal?: boolean
    skillId?: string | null
    lastSyncedAt?: Date | null
  }) {
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
    return fromDb(rule)
  },

  async delete(id: string) {
    await prisma.rule.delete({ where: { id } })
  },

  async toggle(id: string, currentEnabled: boolean) {
    const rule = await prisma.rule.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: rule.id, enabled: rule.enabled }
  },
}
