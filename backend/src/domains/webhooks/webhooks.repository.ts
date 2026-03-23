import { prisma } from '../../lib/prisma.js'
import { encrypt, decrypt } from '../../lib/crypto.js'
import { paginate, buildPaginatedResult, type PaginationParams } from '../../lib/pagination.js'

export const webhooksRepository = {
  async findAll(userId: string) {
    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    })
    return webhooks.map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      deliveriesCount: w._count.deliveries,
      createdAt: w.createdAt.toISOString(),
    }))
  },

  async findAllPaginated(userId: string, pagination: PaginationParams) {
    const where = { userId }
    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { deliveries: true } } },
        ...paginate(pagination),
      }),
      prisma.webhook.count({ where }),
    ])
    const mapped = webhooks.map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      deliveriesCount: w._count.deliveries,
      createdAt: w.createdAt.toISOString(),
    }))
    return buildPaginatedResult(mapped, total, pagination)
  },

  async findById(id: string, userId: string) {
    const w = await prisma.webhook.findFirst({ where: { id, userId } })
    if (!w) return null
    return {
      id: w.id,
      url: w.url,
      events: w.events,
      secret: decrypt(w.secret),
      enabled: w.enabled,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }
  },

  async create(input: { url: string; events: string[]; secret: string; enabled?: boolean }, userId: string) {
    const w = await prisma.webhook.create({
      data: {
        url: input.url,
        events: input.events,
        secret: encrypt(input.secret),
        enabled: input.enabled ?? true,
        userId,
      },
    })
    return { id: w.id, url: w.url, events: w.events, enabled: w.enabled, createdAt: w.createdAt.toISOString() }
  },

  async update(id: string, userId: string, input: { url?: string; events?: string[]; enabled?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.webhook.findFirst({ where: { id, userId } })
      if (!existing) return null

      const data: Record<string, unknown> = {}
      if (input.url !== undefined) data.url = input.url
      if (input.events !== undefined) data.events = input.events
      if (input.enabled !== undefined) data.enabled = input.enabled
      // Use findFirst result id to guarantee ownership (already verified above)
      const w = await tx.webhook.update({ where: { id: existing.id }, data: data as any })
      return { id: w.id, url: w.url, events: w.events, enabled: w.enabled }
    })
  },

  async delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.webhook.findFirst({ where: { id, userId } })
      if (!existing) return
      await tx.webhook.delete({ where: { id: existing.id } })
    })
  },

  async findByEvent(event: string, userId: string) {
    const webhooks = await prisma.webhook.findMany({
      where: { userId, enabled: true },
    })
    return webhooks
      .filter(w => {
        const events = w.events as string[]
        return events.includes(event) || events.includes('*')
      })
      .map(w => ({ ...w, secret: decrypt(w.secret) }))
  },

  async getDeliveries(webhookId: string) {
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },
}
