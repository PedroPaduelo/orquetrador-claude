import { prisma } from '../../lib/prisma.js'

function fromDbList(record: {
  id: string
  name: string
  description: string | null
  type: string
  uri: string | null
  command: string | null
  enabled: boolean
  isGlobal: boolean
  lastTestAt: Date | null
  lastTestOk: boolean | null
  pluginId: string | null
  createdAt: Date
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    uri: record.uri,
    command: record.command,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    lastTestAt: record.lastTestAt?.toISOString() ?? null,
    lastTestOk: record.lastTestOk,
    pluginId: record.pluginId,
    createdAt: record.createdAt.toISOString(),
  }
}

function fromDbFull(record: {
  id: string
  name: string
  description: string | null
  type: string
  uri: string | null
  command: string | null
  args: string | null
  envVars: string | null
  enabled: boolean
  isGlobal: boolean
  toolsCache: string | null
  lastTestAt: Date | null
  lastTestOk: boolean | null
  pluginId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  let toolsCache = null
  if (record.toolsCache) {
    try { toolsCache = JSON.parse(record.toolsCache) } catch { /* ignore */ }
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    uri: record.uri,
    command: record.command,
    args: JSON.parse(record.args || '[]') as string[],
    envVars: JSON.parse(record.envVars || '{}') as Record<string, string>,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    toolsCache,
    lastTestAt: record.lastTestAt?.toISOString() ?? null,
    lastTestOk: record.lastTestOk,
    pluginId: record.pluginId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const mcpServersRepository = {
  async findAll() {
    const servers = await prisma.mcpServer.findMany({ orderBy: { createdAt: 'desc' } })
    return servers.map(fromDbList)
  },

  async findById(id: string) {
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    return server ? fromDbFull(server) : null
  },

  async create(input: {
    name: string
    description?: string | null
    type?: string
    uri?: string | null
    command?: string | null
    args?: string[]
    envVars?: Record<string, string>
    enabled?: boolean
    isGlobal?: boolean
  }) {
    const server = await prisma.mcpServer.create({
      data: {
        name: input.name,
        description: input.description,
        type: input.type ?? 'http',
        uri: input.uri,
        command: input.command,
        args: JSON.stringify(input.args ?? []),
        envVars: JSON.stringify(input.envVars ?? {}),
        enabled: input.enabled ?? true,
        isGlobal: input.isGlobal ?? true,
      },
    })
    return fromDbFull(server)
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    type?: string
    uri?: string | null
    command?: string | null
    args?: string[]
    envVars?: Record<string, string>
    enabled?: boolean
    isGlobal?: boolean
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.type !== undefined) data.type = input.type
    if (input.uri !== undefined) data.uri = input.uri
    if (input.command !== undefined) data.command = input.command
    if (input.args !== undefined) data.args = JSON.stringify(input.args)
    if (input.envVars !== undefined) data.envVars = JSON.stringify(input.envVars)
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal

    const server = await prisma.mcpServer.update({
      where: { id },
      data: data as Parameters<typeof prisma.mcpServer.update>[0]['data'],
    })
    return fromDbFull(server)
  },

  async delete(id: string) {
    await prisma.mcpServer.delete({ where: { id } })
  },

  async toggle(id: string, currentEnabled: boolean) {
    const server = await prisma.mcpServer.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: server.id, enabled: server.enabled }
  },

  async updateTestResult(id: string, ok: boolean) {
    await prisma.mcpServer.update({
      where: { id },
      data: { lastTestAt: new Date(), lastTestOk: ok },
    })
  },
}
