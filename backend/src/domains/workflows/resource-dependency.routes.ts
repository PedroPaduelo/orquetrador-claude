import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { ResourceType } from '@prisma/client'
import { z } from 'zod'
import { getDependents, validateDeletion } from './resource-dependency.service.js'

const resourceTypeEnum = z.enum([
  'mcp_server', 'skill', 'agent', 'rule', 'hook', 'plugin', 'workflow',
])

const resourceParams = z.object({
  resourceType: resourceTypeEnum,
  resourceId: z.string(),
})

const dependentSchema = z.object({
  id: z.string(),
  sourceType: resourceTypeEnum,
  sourceId: z.string(),
  dependencyType: resourceTypeEnum,
  dependencyId: z.string(),
  dependencyName: z.string().nullable(),
  isOptional: z.boolean(),
  createdAt: z.string(),
})

const deletionValidationSchema = z.object({
  canDelete: z.boolean(),
  dependents: z.array(z.object({
    id: z.string(),
    sourceType: resourceTypeEnum,
    sourceId: z.string(),
    dependencyName: z.string().nullable(),
  })),
})

export async function resourceDependencyRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/resources/:resourceType/:resourceId/dependents', {
    schema: {
      tags: ['ResourceDependency'],
      summary: 'List resources that depend on the given resource',
      params: resourceParams,
      response: { 200: z.array(dependentSchema) },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const { resourceType, resourceId } = request.params
    const results = await getDependents(resourceType as ResourceType, resourceId)
    return results.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))
  })

  server.get('/resources/:resourceType/:resourceId/validate-deletion', {
    schema: {
      tags: ['ResourceDependency'],
      summary: 'Check if a resource can be safely deleted',
      params: resourceParams,
      response: { 200: deletionValidationSchema },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const { resourceType, resourceId } = request.params
    return validateDeletion(resourceType as ResourceType, resourceId)
  })
}
