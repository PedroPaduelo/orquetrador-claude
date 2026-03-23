import { prisma } from '../../lib/prisma.js'
import { encrypt, decrypt } from '../../lib/crypto.js'
import { paginate, buildPaginatedResult, type PaginationParams } from '../../lib/pagination.js'

function formatTrigger(t: any) {
  return {
    id: t.id,
    type: t.type,
    cronExpr: t.cronExpr,
    cronTimezone: t.cronTimezone,
    webhookSecret: t.webhookSecret ? decrypt(t.webhookSecret) : null,
    eventName: t.eventName,
    eventFilter: t.eventFilter,
    rateLimit: t.rateLimit,
    enabled: t.enabled,
    lastTriggeredAt: t.lastTriggeredAt?.toISOString() ?? null,
    workflowId: t.workflowId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

function formatScheduled(s: any) {
  return {
    id: s.id,
    scheduledAt: s.scheduledAt.toISOString(),
    executedAt: s.executedAt?.toISOString() ?? null,
    status: s.status,
    result: s.result,
    errorMessage: s.errorMessage,
    triggerId: s.triggerId,
    createdAt: s.createdAt.toISOString(),
  }
}

async function verifyWorkflowOwnership(workflowId: string, userId: string, tx = prisma) {
  const workflow = await tx.workflow.findFirst({ where: { id: workflowId, userId } })
  if (!workflow) return null
  return workflow
}

export const triggersRepository = {
  async findAll(workflowId: string, userId: string) {
    const workflow = await verifyWorkflowOwnership(workflowId, userId)
    if (!workflow) return null
    const triggers = await prisma.workflowTrigger.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { scheduledExecutions: true } } },
    })
    return triggers.map(({ _count, ...t }) => ({
      ...formatTrigger(t),
      scheduledCount: _count.scheduledExecutions,
    }))
  },

  async findAllPaginated(workflowId: string, userId: string, pagination: PaginationParams) {
    const workflow = await verifyWorkflowOwnership(workflowId, userId)
    if (!workflow) return null
    const where = { workflowId }
    const [triggers, total] = await Promise.all([
      prisma.workflowTrigger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { scheduledExecutions: true } } },
        ...paginate(pagination),
      }),
      prisma.workflowTrigger.count({ where }),
    ])
    const mapped = triggers.map(({ _count, ...t }) => ({
      ...formatTrigger(t),
      scheduledCount: _count.scheduledExecutions,
    }))
    return buildPaginatedResult(mapped, total, pagination)
  },

  async findById(id: string, userId: string) {
    const t = await prisma.workflowTrigger.findFirst({
      where: { id },
      include: { workflow: { select: { userId: true } } },
    })
    if (!t || t.workflow.userId !== userId) return null
    return formatTrigger(t)
  },

  async create(workflowId: string, userId: string, input: {
    type: string
    cronExpr?: string
    cronTimezone?: string
    webhookSecret?: string
    eventName?: string
    eventFilter?: unknown
    rateLimit?: number
    enabled?: boolean
  }) {
    const workflow = await verifyWorkflowOwnership(workflowId, userId)
    if (!workflow) return null
    const data: Record<string, unknown> = {
      type: input.type,
      workflowId,
      enabled: input.enabled ?? true,
    }
    if (input.cronExpr !== undefined) data.cronExpr = input.cronExpr
    if (input.cronTimezone !== undefined) data.cronTimezone = input.cronTimezone
    if (input.webhookSecret !== undefined) data.webhookSecret = encrypt(input.webhookSecret)
    if (input.eventName !== undefined) data.eventName = input.eventName
    if (input.eventFilter !== undefined) data.eventFilter = input.eventFilter
    if (input.rateLimit !== undefined) data.rateLimit = input.rateLimit
    const t = await prisma.workflowTrigger.create({ data: data as any })
    return formatTrigger(t)
  },

  async update(id: string, userId: string, input: {
    cronExpr?: string
    cronTimezone?: string
    eventName?: string
    eventFilter?: unknown
    rateLimit?: number
    enabled?: boolean
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.workflowTrigger.findFirst({
        where: { id },
        include: { workflow: { select: { userId: true } } },
      })
      if (!existing || existing.workflow.userId !== userId) return null
      const data: Record<string, unknown> = {}
      if (input.cronExpr !== undefined) data.cronExpr = input.cronExpr
      if (input.cronTimezone !== undefined) data.cronTimezone = input.cronTimezone
      if (input.eventName !== undefined) data.eventName = input.eventName
      if (input.eventFilter !== undefined) data.eventFilter = input.eventFilter
      if (input.rateLimit !== undefined) data.rateLimit = input.rateLimit
      if (input.enabled !== undefined) data.enabled = input.enabled
      const t = await tx.workflowTrigger.update({ where: { id: existing.id }, data: data as any })
      return formatTrigger(t)
    })
  },

  async delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.workflowTrigger.findFirst({
        where: { id },
        include: { workflow: { select: { userId: true } } },
      })
      if (!existing || existing.workflow.userId !== userId) return false
      await tx.workflowTrigger.delete({ where: { id: existing.id } })
      return true
    })
  },

  async findScheduledByTrigger(triggerId: string, userId: string, pagination: PaginationParams) {
    const trigger = await prisma.workflowTrigger.findFirst({
      where: { id: triggerId },
      include: { workflow: { select: { userId: true } } },
    })
    if (!trigger || trigger.workflow.userId !== userId) return null
    const where = { triggerId }
    const [items, total] = await Promise.all([
      prisma.scheduledExecution.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        ...paginate(pagination),
      }),
      prisma.scheduledExecution.count({ where }),
    ])
    return buildPaginatedResult(items.map(formatScheduled), total, pagination)
  },

  async findDueScheduled() {
    return prisma.scheduledExecution.findMany({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      include: { trigger: { include: { workflow: true } } },
      orderBy: { scheduledAt: 'asc' },
    })
  },

  async createScheduledExecution(triggerId: string, scheduledAt: Date) {
    const s = await prisma.scheduledExecution.create({
      data: { triggerId, scheduledAt },
    })
    return formatScheduled(s)
  },

  async updateScheduledStatus(id: string, status: string, extra?: { executedAt?: Date; result?: unknown; errorMessage?: string }) {
    const data: Record<string, unknown> = { status }
    if (extra?.executedAt) data.executedAt = extra.executedAt
    if (extra?.result !== undefined) data.result = extra.result
    if (extra?.errorMessage !== undefined) data.errorMessage = extra.errorMessage
    return prisma.scheduledExecution.update({ where: { id }, data: data as any })
  },

  async cancelPendingByTrigger(triggerId: string) {
    return prisma.scheduledExecution.updateMany({
      where: { triggerId, status: 'pending' },
      data: { status: 'cancelled' },
    })
  },
}
