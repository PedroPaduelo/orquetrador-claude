import { prisma } from '../../lib/prisma.js'
import { logAudit } from '../../lib/audit-log.js'
import type { JsonValue } from '@prisma/client/runtime/library'

function toStringArray(val: JsonValue | null | undefined): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
  return []
}

function fromDb(record: {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  tools: JsonValue
  disallowedTools: JsonValue
  model: string | null
  permissionMode: string
  maxTurns: number | null
  skills: JsonValue
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
    tools: toStringArray(record.tools),
    disallowedTools: toStringArray(record.disallowedTools),
    model: record.model,
    permissionMode: record.permissionMode,
    maxTurns: record.maxTurns,
    skills: toStringArray(record.skills),
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

  async findById(id: string, userId: string) {
    const agent = await prisma.agent.findFirst({ where: { id, userId } })
    return agent ? fromDb(agent) : null
  },

  async findByName(name: string, userId: string) {
    const agent = await prisma.agent.findFirst({ where: { name, userId } })
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
        tools: input.tools ?? [],
        disallowedTools: input.disallowedTools ?? [],
        model: input.model,
        permissionMode: input.permissionMode ?? 'default',
        maxTurns: input.maxTurns,
        skills: input.skills ?? [],
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

    void logAudit({
      userId,
      action: 'create',
      resourceType: 'agent',
      resourceId: agent.id,
      resourceName: agent.name,
      diff: { after: fromDb(agent) },
    })

    return fromDb(agent)
  },

  async update(id: string, userId: string, input: {
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
    const before = await prisma.agent.findUnique({ where: { id } })
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt
    if (input.tools !== undefined) data.tools = input.tools
    if (input.disallowedTools !== undefined) data.disallowedTools = input.disallowedTools
    if (input.model !== undefined) data.model = input.model
    if (input.permissionMode !== undefined) data.permissionMode = input.permissionMode
    if (input.maxTurns !== undefined) data.maxTurns = input.maxTurns
    if (input.skills !== undefined) data.skills = input.skills
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal
    if (input.lastSyncedAt !== undefined) data.lastSyncedAt = input.lastSyncedAt

    const agent = await prisma.agent.update({
      where: { id },
      data: data as Parameters<typeof prisma.agent.update>[0]['data'],
    })

    void logAudit({
      userId,
      action: 'update',
      resourceType: 'agent',
      resourceId: agent.id,
      resourceName: agent.name,
      diff: { before: before ? fromDb(before) : undefined, after: fromDb(agent) },
    })

    return fromDb(agent)
  },

  async delete(id: string, userId: string) {
    const before = await prisma.agent.findUnique({ where: { id } })
    await prisma.agent.deleteMany({ where: { id, userId } })

    if (before) {
      void logAudit({
        userId,
        action: 'delete',
        resourceType: 'agent',
        resourceId: id,
        resourceName: before.name,
        diff: { before: fromDb(before) },
      })
    }
  },

  async toggle(id: string, _userId: string, currentEnabled: boolean) {
    const agent = await prisma.agent.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: agent.id, enabled: agent.enabled }
  },
}
