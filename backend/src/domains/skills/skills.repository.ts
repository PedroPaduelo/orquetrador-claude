import { prisma } from '../../lib/prisma.js'
import { logAudit } from '../../lib/audit-log.js'
import type { JsonValue, InputJsonValue } from '@prisma/client/runtime/library'

function toStringArray(val: JsonValue | null | undefined): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
  return []
}

function fromDb(record: {
  id: string
  name: string
  description: string | null
  body: string
  allowedTools: JsonValue
  model: string | null
  enabled: boolean
  isGlobal: boolean
  pluginId: string | null
  source: string
  repoUrl: string | null
  repoOwner: string | null
  repoName: string | null
  repoBranch: string | null
  repoPath: string | null
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    body: record.body,
    allowedTools: toStringArray(record.allowedTools),
    model: record.model,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    pluginId: record.pluginId,
    source: record.source,
    repoUrl: record.repoUrl,
    repoOwner: record.repoOwner,
    repoName: record.repoName,
    repoBranch: record.repoBranch,
    repoPath: record.repoPath,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const skillsRepository = {
  async findAll(userId: string) {
    const skills = await prisma.skill.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    return skills.map(fromDb)
  },

  async findById(id: string, userId: string) {
    const skill = await prisma.skill.findFirst({ where: { id, userId } })
    return skill ? fromDb(skill) : null
  },

  async findByName(name: string, userId: string) {
    const skill = await prisma.skill.findFirst({ where: { name, userId } })
    return skill ? fromDb(skill) : null
  },

  async create(input: {
    name: string
    description?: string | null
    body?: string
    allowedTools?: string[]
    model?: string | null
    enabled?: boolean
    isGlobal?: boolean
    frontmatter?: Record<string, unknown>
    source?: string
    repoUrl?: string | null
    repoOwner?: string | null
    repoName?: string | null
    repoBranch?: string | null
    repoPath?: string | null
    fileManifest?: Array<{ path: string; content: string }>
    projectPath?: string | null
    lastSyncedAt?: Date | null
  }, userId: string) {
    const skill = await prisma.skill.create({
      data: {
        ...input,
        userId,
        frontmatter: input.frontmatter as InputJsonValue | undefined,
        fileManifest: input.fileManifest as InputJsonValue | undefined,
      },
    })

    void logAudit({
      userId,
      action: 'create',
      resourceType: 'skill',
      resourceId: skill.id,
      resourceName: skill.name,
      diff: { after: fromDb(skill) },
    })

    return fromDb(skill)
  },

  async update(id: string, userId: string, input: {
    name?: string
    description?: string
    body?: string
    allowedTools?: string[]
    model?: string | null
    enabled?: boolean
    isGlobal?: boolean
    frontmatter?: Record<string, unknown>
    fileManifest?: Array<{ path: string; content: string }>
    lastSyncedAt?: Date | null
  }) {
    const before = await prisma.skill.findUnique({ where: { id } })
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.body !== undefined) data.body = input.body
    if (input.allowedTools !== undefined) data.allowedTools = input.allowedTools
    if (input.model !== undefined) data.model = input.model
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal
    if (input.frontmatter !== undefined) data.frontmatter = input.frontmatter
    if (input.fileManifest !== undefined) data.fileManifest = input.fileManifest
    if (input.lastSyncedAt !== undefined) data.lastSyncedAt = input.lastSyncedAt

    const skill = await prisma.skill.update({
      where: { id },
      data: data as Parameters<typeof prisma.skill.update>[0]['data'],
    })

    void logAudit({
      userId,
      action: 'update',
      resourceType: 'skill',
      resourceId: skill.id,
      resourceName: skill.name,
      diff: { before: before ? fromDb(before) : undefined, after: fromDb(skill) },
    })

    return fromDb(skill)
  },

  async delete(id: string, userId: string) {
    const before = await prisma.skill.findUnique({ where: { id } })
    await prisma.skill.deleteMany({ where: { id, userId } })

    if (before) {
      void logAudit({
        userId,
        action: 'delete',
        resourceType: 'skill',
        resourceId: id,
        resourceName: before.name,
        diff: { before: fromDb(before) },
      })
    }
  },

  async toggle(id: string, _userId: string, currentEnabled: boolean) {
    const skill = await prisma.skill.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: skill.id, enabled: skill.enabled }
  },
}
