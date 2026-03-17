import { prisma } from '../../lib/prisma.js'

export const stepTemplatesRepository = {
  async findAll(userId: string) {
    const templates = await prisma.stepTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
    return templates.map(t => ({
      ...t,
      resourceIds: JSON.parse(t.resourceIds || '{}'),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  },

  async findById(id: string, userId: string) {
    const t = await prisma.stepTemplate.findFirst({ where: { id, userId } })
    if (!t) return null
    return {
      ...t,
      resourceIds: JSON.parse(t.resourceIds || '{}'),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  },

  async create(input: {
    name: string
    description?: string | null
    baseUrl?: string
    systemPrompt?: string | null
    conditions?: string
    resourceIds?: Record<string, string[]>
  }, userId: string) {
    const t = await prisma.stepTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        baseUrl: input.baseUrl || '',
        systemPrompt: input.systemPrompt,
        conditions: input.conditions || '{}',
        resourceIds: JSON.stringify(input.resourceIds || {}),
        userId,
      },
    })
    return { ...t, resourceIds: JSON.parse(t.resourceIds), createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }
  },

  async update(id: string, _userId: string, input: {
    name?: string
    description?: string | null
    baseUrl?: string
    systemPrompt?: string | null
    conditions?: string
    resourceIds?: Record<string, string[]>
  }) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt
    if (input.conditions !== undefined) data.conditions = input.conditions
    if (input.resourceIds !== undefined) data.resourceIds = JSON.stringify(input.resourceIds)

    const t = await prisma.stepTemplate.update({ where: { id }, data: data as any })
    return { ...t, resourceIds: JSON.parse(t.resourceIds), createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }
  },

  async delete(id: string) {
    await prisma.stepTemplate.delete({ where: { id } })
  },
}
