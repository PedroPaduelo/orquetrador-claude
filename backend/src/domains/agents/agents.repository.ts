import { prisma } from '../../lib/prisma.js'

function safeParseArray(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'string') return parsed.split(',').map((s) => s.trim()).filter(Boolean)
    return []
  } catch {
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

function fromDb(record: {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  tools: string | null
  disallowedTools: string | null
  model: string | null
  permissionMode: string
  maxTurns: number | null
  skills: string | null
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
    systemPrompt: record.systemPrompt,
    tools: safeParseArray(record.tools),
    disallowedTools: safeParseArray(record.disallowedTools),
    model: record.model,
    permissionMode: record.permissionMode,
    maxTurns: record.maxTurns,
    skills: safeParseArray(record.skills),
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

export const agentsRepository = {
  async findAll(userId: string) {
    const agents = await prisma.agent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    return agents.map(fromDb)
  },

  async findById(id: string) {
    const agent = await prisma.agent.findUnique({ where: { id } })
    return agent ? fromDb(agent) : null
  },

  async findByName(name: string) {
    const agent = await prisma.agent.findUnique({ where: { name } })
    return agent ? fromDb(agent) : null
  },

  async create(input: {
    name: string
    description?: string | null
    systemPrompt?: string
    tools?: string[]
    disallowedTools?: string[]
    model?: string | null
    permissionMode?: string
    maxTurns?: number | null
    skills?: string[]
    enabled?: boolean
    isGlobal?: boolean
    source?: string
    repoUrl?: string | null
    repoOwner?: string | null
    repoName?: string | null
    repoBranch?: string | null
    repoPath?: string | null
    projectPath?: string | null
    lastSyncedAt?: Date | null
  }, userId: string) {
    const agent = await prisma.agent.create({
      data: {
        name: input.name,
        userId,
        description: input.description,
        systemPrompt: input.systemPrompt ?? '',
        tools: JSON.stringify(input.tools ?? []),
        disallowedTools: JSON.stringify(input.disallowedTools ?? []),
        model: input.model,
        permissionMode: input.permissionMode ?? 'default',
        maxTurns: input.maxTurns,
        skills: JSON.stringify(input.skills ?? []),
        enabled: input.enabled ?? true,
        isGlobal: input.isGlobal ?? true,
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
    return fromDb(agent)
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    systemPrompt?: string
    tools?: string[]
    disallowedTools?: string[]
    model?: string | null
    permissionMode?: string
    maxTurns?: number | null
    skills?: string[]
    enabled?: boolean
    isGlobal?: boolean
    lastSyncedAt?: Date | null
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt
    if (input.tools !== undefined) data.tools = JSON.stringify(input.tools)
    if (input.disallowedTools !== undefined) data.disallowedTools = JSON.stringify(input.disallowedTools)
    if (input.model !== undefined) data.model = input.model
    if (input.permissionMode !== undefined) data.permissionMode = input.permissionMode
    if (input.maxTurns !== undefined) data.maxTurns = input.maxTurns
    if (input.skills !== undefined) data.skills = JSON.stringify(input.skills)
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal
    if (input.lastSyncedAt !== undefined) data.lastSyncedAt = input.lastSyncedAt

    const agent = await prisma.agent.update({
      where: { id },
      data: data as Parameters<typeof prisma.agent.update>[0]['data'],
    })
    return fromDb(agent)
  },

  async delete(id: string) {
    await prisma.agent.delete({ where: { id } })
  },

  async toggle(id: string, currentEnabled: boolean) {
    const agent = await prisma.agent.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: agent.id, enabled: agent.enabled }
  },
}
