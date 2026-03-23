import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { tagsRepository } from './tags.repository.js'
import { NotFoundError, ConflictError } from '../../http/errors/index.js'
import {
  resourceTypeEnum, tagResponse, tagListResponse,
  createTagBody, updateTagBody, addResourceBody,
  resourceTagResponse, resourceTagWithTagResponse,
} from './tags.schema.js'

export async function tagsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/tags', {
    schema: { tags: ['Tags'], summary: 'List all tags', response: { 200: tagListResponse } },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    return tagsRepository.findAll(userId)
  })

  server.post('/tags', {
    schema: { tags: ['Tags'], summary: 'Create a new tag', body: createTagBody, response: { 201: tagResponse } },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    try {
      const tag = await tagsRepository.create({ ...request.body, userId })
      return reply.status(201).send(tag)
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictError('Tag with this name already exists')
      throw err
    }
  })

  server.put('/tags/:id', {
    schema: {
      tags: ['Tags'], summary: 'Update a tag',
      params: z.object({ id: z.string() }), body: updateTagBody, response: { 200: tagResponse },
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const tag = await tagsRepository.findById(request.params.id)
    if (!tag || tag.userId !== userId) throw new NotFoundError('Tag not found')
    return tagsRepository.update(request.params.id, request.body)
  })

  server.delete('/tags/:id', {
    schema: { tags: ['Tags'], summary: 'Delete a tag', params: z.object({ id: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const tag = await tagsRepository.findById(request.params.id)
    if (!tag || tag.userId !== userId) throw new NotFoundError('Tag not found')
    await tagsRepository.delete(request.params.id)
    return reply.status(204).send(null)
  })

  server.post('/tags/:id/resources', {
    schema: {
      tags: ['Tags'], summary: 'Add a resource to a tag',
      params: z.object({ id: z.string() }), body: addResourceBody, response: { 201: resourceTagResponse },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const tag = await tagsRepository.findById(request.params.id)
    if (!tag || tag.userId !== userId) throw new NotFoundError('Tag not found')
    try {
      const rt = await tagsRepository.addResource(request.params.id, request.body.resourceType, request.body.resourceId)
      return reply.status(201).send(rt)
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictError('Resource already tagged')
      throw err
    }
  })

  server.delete('/tags/:id/resources/:resourceType/:resourceId', {
    schema: {
      tags: ['Tags'], summary: 'Remove a resource from a tag',
      params: z.object({ id: z.string(), resourceType: resourceTypeEnum, resourceId: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const tag = await tagsRepository.findById(request.params.id)
    if (!tag || tag.userId !== userId) throw new NotFoundError('Tag not found')
    await tagsRepository.removeResource(request.params.id, request.params.resourceType, request.params.resourceId)
    return reply.status(204).send(null)
  })

  server.get('/resources/:resourceType/:resourceId/tags', {
    schema: {
      tags: ['Tags'], summary: 'Get all tags for a resource',
      params: z.object({ resourceType: resourceTypeEnum, resourceId: z.string() }),
      response: { 200: resourceTagWithTagResponse },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    return tagsRepository.getResourceTags(request.params.resourceType, request.params.resourceId)
  })
}
