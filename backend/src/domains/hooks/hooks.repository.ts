import { prisma } from '../../lib/prisma.js'

function fromDb(record: {
  id: string
  name: string
  description: string | null
  eventType: string
  matcher: string | null
  handlerType: string
  command: string | null
  prompt: string | null
  timeout: number
  isAsync: boolean
  statusMessage: string | null
  enabled: boolean
  isGlobal: boolean
  projectPath: string | null
  isTemplate: boolean
  templateId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    eventType: record.eventType,
    matcher: record.matcher,
    handlerType: record.handlerType,
    command: record.command,
    prompt: record.prompt,
    timeout: record.timeout,
    isAsync: record.isAsync,
    statusMessage: record.statusMessage,
    enabled: record.enabled,
    isGlobal: record.isGlobal,
    projectPath: record.projectPath,
    isTemplate: record.isTemplate,
    templateId: record.templateId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const hooksRepository = {
  async findAll(userId: string) {
    const hooks = await prisma.hook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return hooks.map(fromDb)
  },

  async findById(id: string) {
    const hook = await prisma.hook.findUnique({ where: { id } })
    return hook ? fromDb(hook) : null
  },

  async create(input: {
    name: string
    description?: string | null
    eventType: string
    matcher?: string | null
    handlerType?: string
    command?: string | null
    prompt?: string | null
    timeout?: number
    isAsync?: boolean
    statusMessage?: string | null
    enabled?: boolean
    isGlobal?: boolean
    projectPath?: string | null
    isTemplate?: boolean
    templateId?: string | null
  }, userId: string) {
    const hook = await prisma.hook.create({
      data: {
        name: input.name,
        userId,
        description: input.description,
        eventType: input.eventType,
        matcher: input.matcher ?? null,
        handlerType: input.handlerType ?? 'command',
        command: input.command ?? null,
        prompt: input.prompt ?? null,
        timeout: input.timeout ?? 60000,
        isAsync: input.isAsync ?? false,
        statusMessage: input.statusMessage ?? null,
        enabled: input.enabled ?? true,
        isGlobal: input.isGlobal ?? true,
        projectPath: input.projectPath ?? null,
        isTemplate: input.isTemplate ?? false,
        templateId: input.templateId ?? null,
      },
    })
    return fromDb(hook)
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    eventType?: string
    matcher?: string | null
    handlerType?: string
    command?: string | null
    prompt?: string | null
    timeout?: number
    isAsync?: boolean
    statusMessage?: string | null
    enabled?: boolean
    isGlobal?: boolean
    projectPath?: string | null
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.eventType !== undefined) data.eventType = input.eventType
    if (input.matcher !== undefined) data.matcher = input.matcher
    if (input.handlerType !== undefined) data.handlerType = input.handlerType
    if (input.command !== undefined) data.command = input.command
    if (input.prompt !== undefined) data.prompt = input.prompt
    if (input.timeout !== undefined) data.timeout = input.timeout
    if (input.isAsync !== undefined) data.isAsync = input.isAsync
    if (input.statusMessage !== undefined) data.statusMessage = input.statusMessage
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal
    if (input.projectPath !== undefined) data.projectPath = input.projectPath

    const hook = await prisma.hook.update({
      where: { id },
      data: data as Parameters<typeof prisma.hook.update>[0]['data'],
    })
    return fromDb(hook)
  },

  async delete(id: string) {
    await prisma.hook.delete({ where: { id } })
  },

  async toggle(id: string, currentEnabled: boolean) {
    const hook = await prisma.hook.update({
      where: { id },
      data: { enabled: !currentEnabled },
    })
    return { id: hook.id, enabled: hook.enabled }
  },
}
