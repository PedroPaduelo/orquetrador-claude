import { prisma } from '../../lib/prisma.js'

// ---- toDb / fromDb helpers ----

function toDb(input: {
  name: string
  description?: string
  body?: string
  allowedTools?: string[]
  model?: string | null
  enabled?: boolean
  isGlobal?: boolean
  frontmatter?: string
  source?: string
  repoUrl?: string | null
  repoOwner?: string | null
  repoName?: string | null
  repoBranch?: string | null
  repoPath?: string | null
  fileManifest?: string
  projectPath?: string | null
  pluginId?: string | null
  lastSyncedAt?: Date | null
}) {
  return {
    ...input,
    allowedTools: input.allowedTools !== undefined ? JSON.stringify(input.allowedTools) : undefined,
  }
}

function fromDb(record: {
  id: string
  name: string
  description: string | null
  body: string
  allowedTools: string | null
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
    allowedTools: JSON.parse(record.allowedTools || '[]') as string[],
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
    frontmatter?: string
    source?: string
    repoUrl?: string | null
    repoOwner?: string | null
    repoName?: string | null
    repoBranch?: string | null
    repoPath?: string | null
    fileManifest?: string
    projectPath?: string | null
    lastSyncedAt?: Date | null
  }, userId: string) {
    const skill = await prisma.skill.create({
      data: { ...toDb(input as Parameters<typeof toDb>[0]), userId },
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
    frontmatter?: string
    fileManifest?: string
    lastSyncedAt?: Date | null
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.body !== undefined) data.body = input.body
    if (input.allowedTools !== undefined) data.allowedTools = JSON.stringify(input.allowedTools)
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
    return fromDb(skill)
  },

  async delete(id: string, userId: string) {
    await prisma.skill.deleteMany({ where: { id, userId } })
  },

  async toggle(id: string, userId: string, currentEnabled: boolean) {
    const skill = await prisma.skill.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: skill.id, enabled: skill.enabled }
  },
}
