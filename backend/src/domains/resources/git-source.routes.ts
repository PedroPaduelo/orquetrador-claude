import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { gitSourceRepository } from './git-source.repository.js'
import type { ResourceType } from '@prisma/client'

const resourceTypeEnum = z.enum([
  'mcp_server', 'skill', 'agent', 'rule', 'hook', 'plugin', 'workflow',
])

const gitSourceResponse = z.object({
  id: z.string(),
  resourceType: resourceTypeEnum,
  resourceId: z.string(),
  repoOwner: z.string(),
  repoName: z.string(),
  repoBranch: z.string(),
  repoPath: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const upsertBody = z.object({
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  repoBranch: z.string().optional(),
  repoPath: z.string().nullable().optional(),
})

const resourceParams = z.object({
  resourceType: resourceTypeEnum,
  resourceId: z.string(),
})

export async function gitSourceRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/resources/:resourceType/:resourceId/git-source', {
    schema: {
      tags: ['GitSource'],
      summary: 'Get git source for a resource',
      params: resourceParams,
      response: { 200: gitSourceResponse.nullable() },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const { resourceType, resourceId } = request.params
    return gitSourceRepository.findByResource(resourceType as ResourceType, resourceId)
  })

  server.put('/resources/:resourceType/:resourceId/git-source', {
    schema: {
      tags: ['GitSource'],
      summary: 'Create or update git source for a resource',
      params: resourceParams,
      body: upsertBody,
      response: { 200: gitSourceResponse },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const { resourceType, resourceId } = request.params
    return gitSourceRepository.upsert({
      resourceType: resourceType as ResourceType,
      resourceId,
      ...request.body,
    })
  })

  server.delete('/resources/:resourceType/:resourceId/git-source', {
    schema: {
      tags: ['GitSource'],
      summary: 'Delete git source for a resource',
      params: resourceParams,
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    await request.getCurrentUserId()
    const { resourceType, resourceId } = request.params
    await gitSourceRepository.delete(resourceType as ResourceType, resourceId)
    return reply.status(204).send(null)
  })

  server.get('/git-sources', {
    schema: {
      tags: ['GitSource'],
      summary: 'List git sources by resource type',
      querystring: z.object({ resourceType: resourceTypeEnum }),
      response: { 200: z.array(gitSourceResponse) },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    return gitSourceRepository.listByType(request.query.resourceType as ResourceType)
  })
}
