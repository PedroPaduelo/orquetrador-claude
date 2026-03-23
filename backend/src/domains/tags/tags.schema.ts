import { z } from 'zod'
import { ResourceType } from '@prisma/client'

export const resourceTypeEnum = z.nativeEnum(ResourceType)

export const tagResponse = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
})

export const tagListResponse = z.array(tagResponse.extend({
  _count: z.object({ resources: z.number() }),
}))

export const createTagBody = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const updateTagBody = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
})

export const addResourceBody = z.object({
  resourceType: resourceTypeEnum,
  resourceId: z.string().min(1),
})

export const resourceTagResponse = z.object({
  id: z.string(),
  tagId: z.string(),
  resourceType: resourceTypeEnum,
  resourceId: z.string(),
  createdAt: z.string(),
})

export const resourceTagWithTagResponse = z.array(z.object({
  id: z.string(),
  resourceType: resourceTypeEnum,
  resourceId: z.string(),
  createdAt: z.string(),
  tag: tagResponse,
}))
