import { ResourceType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

function formatTag(tag: { id: string; name: string; color: string | null; createdAt: Date; userId: string }) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    userId: tag.userId,
  }
}

function formatResourceTag(rt: { id: string; resourceType: ResourceType; resourceId: string; createdAt: Date; tagId: string }) {
  return {
    id: rt.id,
    tagId: rt.tagId,
    resourceType: rt.resourceType,
    resourceId: rt.resourceId,
    createdAt: rt.createdAt.toISOString(),
  }
}

export const tagsRepository = {
  async findAll(userId: string) {
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { resources: true } } },
    })
    return tags.map(({ _count, ...tag }) => ({
      ...formatTag(tag),
      _count,
    }))
  },

  async findById(id: string) {
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: { resources: { orderBy: { createdAt: 'desc' } } },
    })
    if (!tag) return null
    const { resources, ...rest } = tag
    return {
      ...formatTag(rest),
      resources: resources.map(formatResourceTag),
    }
  },

  async create(input: { name: string; color?: string; userId: string }) {
    const tag = await prisma.tag.create({
      data: { name: input.name, color: input.color, userId: input.userId },
    })
    return formatTag(tag)
  },

  async update(id: string, input: { name?: string; color?: string | null }) {
    const tag = await prisma.tag.update({ where: { id }, data: input })
    return formatTag(tag)
  },

  async delete(id: string) {
    return prisma.tag.delete({ where: { id } })
  },

  async addResource(tagId: string, resourceType: ResourceType, resourceId: string) {
    const rt = await prisma.resourceTag.create({
      data: { tagId, resourceType, resourceId },
    })
    return formatResourceTag(rt)
  },

  async removeResource(tagId: string, resourceType: ResourceType, resourceId: string) {
    return prisma.resourceTag.delete({
      where: { tagId_resourceType_resourceId: { tagId, resourceType, resourceId } },
    })
  },

  async getResourceTags(resourceType: ResourceType, resourceId: string) {
    const rts = await prisma.resourceTag.findMany({
      where: { resourceType, resourceId },
      include: { tag: true },
      orderBy: { tag: { name: 'asc' } },
    })
    return rts.map(({ tag, ...rt }) => ({
      ...formatResourceTag(rt),
      tag: formatTag(tag),
    }))
  },
}
