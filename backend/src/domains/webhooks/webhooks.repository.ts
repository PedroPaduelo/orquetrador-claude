import { prisma } from '../../lib/prisma.js'

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

  async findById(id: string, userId: string) {
    const w = await prisma.webhook.findFirst({ where: { id, userId } })
    if (!w) return null
    return {
      id: w.id,
      url: w.url,
      events: w.events,
      secret: w.secret,
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
        secret: input.secret,
        enabled: input.enabled ?? true,
        userId,
      },
    })
    return { id: w.id, url: w.url, events: w.events, enabled: w.enabled, createdAt: w.createdAt.toISOString() }
  },

  async update(id: string, input: { url?: string; events?: string[]; enabled?: boolean }) {
    const data: Record<string, unknown> = {}
    if (input.url !== undefined) data.url = input.url
    if (input.events !== undefined) data.events = input.events
    if (input.enabled !== undefined) data.enabled = input.enabled
    const w = await prisma.webhook.update({ where: { id }, data: data as any })
    return { id: w.id, url: w.url, events: w.events, enabled: w.enabled }
  },

  async delete(id: string) {
    await prisma.webhook.delete({ where: { id } })
  },

  async findByEvent(event: string, userId: string) {
    const webhooks = await prisma.webhook.findMany({
      where: { userId, enabled: true },
    })
    return webhooks.filter(w => {
      const events = w.events as string[]
      return events.includes(event) || events.includes('*')
    })
  },

  async getDeliveries(webhookId: string) {
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },
}
