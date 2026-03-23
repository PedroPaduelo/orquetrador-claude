import { prisma } from '../../lib/prisma.js'
import { logAudit } from '../../lib/audit-log.js'
import { validateMcpServerUrl } from '../../lib/validation.js'
import { paginate, buildPaginatedResult, type PaginationParams } from '../../lib/pagination.js'

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
  args: unknown
  envVars: unknown
  enabled: boolean
  isGlobal: boolean
  toolsCache: unknown
  lastTestAt: Date | null
  lastTestOk: boolean | null
  pluginId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    uri: record.uri,
    command: record.command,
    args: (record.args ?? []) as string[],
    envVars: (record.envVars ?? {}) as Record<string, string>,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    toolsCache: record.toolsCache ?? null,
    lastTestAt: record.lastTestAt?.toISOString() ?? null,
    lastTestOk: record.lastTestOk,
    pluginId: record.pluginId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const mcpServersRepository = {
  async findAll(userId: string) {
    const servers = await prisma.mcpServer.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })
    return servers.map(fromDbList)
  },

  async findAllPaginated(userId: string, pagination: PaginationParams) {
    const where = { userId }
    const [servers, total] = await Promise.all([
      prisma.mcpServer.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(pagination) }),
      prisma.mcpServer.count({ where }),
    ])
    return buildPaginatedResult(servers.map(fromDbList), total, pagination)
  },

  async findById(id: string, userId: string) {
    const server = await prisma.mcpServer.findFirst({ where: { id, userId } })
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
  }, userId: string) {
    if ((input.type === 'http' || input.type === 'sse') && input.uri) {
      validateMcpServerUrl(input.uri)
    }

    const server = await prisma.mcpServer.create({
      data: {
        name: input.name,
        description: input.description,
        type: input.type ?? 'http',
        uri: input.uri,
        command: input.command,
        args: input.args ?? [],
        envVars: input.envVars ?? {},
        enabled: input.enabled ?? true,
        isGlobal: input.isGlobal ?? true,
        userId,
      },
    })

    void logAudit({
      userId,
      action: 'create',
      resourceType: 'mcp_server',
      resourceId: server.id,
      resourceName: server.name,
      diff: { after: fromDbFull(server) },
    })

    return fromDbFull(server)
  },

  async update(id: string, userId: string, input: {
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
    if ((input.type === 'http' || input.type === 'sse') && input.uri) {
      validateMcpServerUrl(input.uri)
    }

    const before = await prisma.mcpServer.findUnique({ where: { id } })
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.type !== undefined) data.type = input.type
    if (input.uri !== undefined) data.uri = input.uri
    if (input.command !== undefined) data.command = input.command
    if (input.args !== undefined) data.args = input.args
    if (input.envVars !== undefined) data.envVars = input.envVars
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal

    const server = await prisma.mcpServer.update({
      where: { id },
      data: data as Parameters<typeof prisma.mcpServer.update>[0]['data'],
    })

    void logAudit({
      userId,
      action: 'update',
      resourceType: 'mcp_server',
      resourceId: server.id,
      resourceName: server.name,
      diff: { before: before ? fromDbFull(before) : undefined, after: fromDbFull(server) },
    })

    return fromDbFull(server)
  },

  async delete(id: string, userId: string) {
    const before = await prisma.mcpServer.findUnique({ where: { id } })
    await prisma.mcpServer.deleteMany({ where: { id, userId } })

    if (before) {
      void logAudit({
        userId,
        action: 'delete',
        resourceType: 'mcp_server',
        resourceId: id,
        resourceName: before.name,
        diff: { before: fromDbFull(before) },
      })
    }
  },

  async toggle(id: string, _userId: string, currentEnabled: boolean) {
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
