import { prisma } from '../../lib/prisma.js'

// ---- fromDb helper ----

function fromDb(record: {
  id: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  manifest: string
  enabled: boolean
  source: string
  repoUrl: string | null
  projectPath: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    version: record.version,
    author: record.author,
    manifest: (() => { try { return JSON.parse(record.manifest) } catch { return {} } })(),
    enabled: record.enabled,
    source: record.source,
    repoUrl: record.repoUrl,
    projectPath: record.projectPath,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const pluginsRepository = {
  async findAll(userId: string) {
    const plugins = await prisma.plugin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { mcpServers: true, skills: true, agents: true },
        },
      },
    })
    return plugins.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      author: p.author,
      enabled: p.enabled,
      source: p.source,
      repoUrl: p.repoUrl,
      mcpServersCount: p._count.mcpServers,
      skillsCount: p._count.skills,
      agentsCount: p._count.agents,
      createdAt: p.createdAt.toISOString(),
    }))
  },

  async findById(id: string) {
    const plugin = await prisma.plugin.findUnique({
      where: { id },
      include: {
        mcpServers: { select: { id: true, name: true, type: true, enabled: true } },
        skills: { select: { id: true, name: true, description: true, enabled: true } },
        agents: { select: { id: true, name: true, description: true, enabled: true } },
      },
    })
    if (!plugin) return null
    return {
      ...fromDb(plugin),
      mcpServers: plugin.mcpServers,
      skills: plugin.skills,
      agents: plugin.agents,
    }
  },

  async findByName(name: string) {
    const plugin = await prisma.plugin.findUnique({ where: { name } })
    return plugin ? fromDb(plugin) : null
  },

  async create(input: {
    name: string
    description?: string | null
    version?: string | null
    author?: string | null
    manifest?: object
    enabled?: boolean
    source?: string
    repoUrl?: string | null
    projectPath?: string | null
    mcpServers?: Array<{
      name: string
      description?: string | null
      type: string
      uri?: string | null
      command?: string | null
      args?: string[]
      envVars?: Record<string, string>
    }>
    skills?: Array<{
      name: string
      description?: string | null
      body?: string
      allowedTools?: string[]
      model?: string | null
    }>
    agents?: Array<{
      name: string
      description?: string | null
      systemPrompt?: string
      tools?: string[]
      disallowedTools?: string[]
      model?: string | null
      permissionMode?: string
      maxTurns?: number | null
      skills?: string[]
    }>
  }, userId: string) {
    const plugin = await prisma.plugin.create({
      data: {
        name: input.name,
        userId,
        description: input.description ?? null,
        version: input.version ?? null,
        author: input.author ?? null,
        manifest: JSON.stringify(input.manifest ?? {}),
        enabled: input.enabled ?? true,
        source: input.source ?? 'manual',
        repoUrl: input.repoUrl ?? null,
        projectPath: input.projectPath ?? null,
        mcpServers: input.mcpServers?.length
          ? {
              create: input.mcpServers.map((s) => ({
                name: s.name,
                description: s.description ?? null,
                type: s.type,
                uri: s.uri ?? null,
                command: s.command ?? null,
                args: JSON.stringify(s.args ?? []),
                envVars: JSON.stringify(s.envVars ?? {}),
                enabled: true,
                isGlobal: false,
                userId,
              })),
            }
          : undefined,
        skills: input.skills?.length
          ? {
              create: input.skills.map((s) => ({
                name: s.name,
                description: s.description ?? null,
                body: s.body ?? '',
                allowedTools: JSON.stringify(s.allowedTools ?? []),
                model: s.model ?? null,
                enabled: true,
                isGlobal: false,
                userId,
              })),
            }
          : undefined,
        agents: input.agents?.length
          ? {
              create: input.agents.map((a) => ({
                name: a.name,
                description: a.description ?? null,
                systemPrompt: a.systemPrompt ?? '',
                tools: JSON.stringify(a.tools ?? []),
                disallowedTools: JSON.stringify(a.disallowedTools ?? []),
                model: a.model ?? null,
                permissionMode: a.permissionMode ?? 'default',
                maxTurns: a.maxTurns ?? null,
                skills: JSON.stringify(a.skills ?? []),
                enabled: true,
                isGlobal: false,
                userId,
              })),
            }
          : undefined,
      },
    })
    return fromDb(plugin)
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    version?: string | null
    author?: string | null
    enabled?: boolean
    projectPath?: string | null
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.version !== undefined) data.version = input.version
    if (input.author !== undefined) data.author = input.author
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.projectPath !== undefined) data.projectPath = input.projectPath

    const plugin = await prisma.plugin.update({
      where: { id },
      data: data as Parameters<typeof prisma.plugin.update>[0]['data'],
    })
    return fromDb(plugin)
  },

  async delete(id: string) {
    await prisma.mcpServer.deleteMany({ where: { pluginId: id } })
    await prisma.skill.deleteMany({ where: { pluginId: id } })
    await prisma.agent.deleteMany({ where: { pluginId: id } })
    await prisma.plugin.delete({ where: { id } })
  },

  async toggle(id: string, currentEnabled: boolean) {
    const next = !currentEnabled
    const [plugin] = await prisma.$transaction([
      prisma.plugin.update({ where: { id }, data: { enabled: next } }),
      prisma.mcpServer.updateMany({ where: { pluginId: id }, data: { enabled: next } }),
      prisma.skill.updateMany({ where: { pluginId: id }, data: { enabled: next } }),
      prisma.agent.updateMany({ where: { pluginId: id }, data: { enabled: next } }),
    ])
    return { id: plugin.id, enabled: plugin.enabled }
  },
}
