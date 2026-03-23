import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { workflowVersioningService } from './workflow-versioning.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function workflowVersionsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/workflows/:id/versions', {
    schema: {
      tags: ['Workflow Versions'],
      summary: 'List all versions of a workflow',
      params: z.object({ id: z.string() }),
      response: {
        200: z.array(z.object({
          id: z.string(),
          version: z.number(),
          changelog: z.string().nullable(),
          diff: z.unknown().nullable(),
          createdAt: z.string(),
        })),
      },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    return workflowVersioningService.listVersions(request.params.id)
  })

  server.get('/workflows/:id/versions/:version', {
    schema: {
      tags: ['Workflow Versions'],
      summary: 'Get a specific version with full snapshot',
      params: z.object({ id: z.string(), version: z.coerce.number() }),
      response: {
        200: z.object({
          id: z.string(),
          version: z.number(),
          snapshot: z.unknown(),
          diff: z.unknown().nullable(),
          changelog: z.string().nullable(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const result = await workflowVersioningService.getVersion(request.params.id, request.params.version)
    if (!result) throw new NotFoundError('Version not found')
    return result
  })

  server.post('/workflows/:id/versions/rollback', {
    schema: {
      tags: ['Workflow Versions'],
      summary: 'Rollback workflow to a specific version',
      params: z.object({ id: z.string() }),
      body: z.object({ version: z.number() }),
      response: {
        200: z.object({
          id: z.string(),
          version: z.number(),
          changelog: z.string().nullable(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const result = await workflowVersioningService.rollback(request.params.id, request.body.version)
    if (!result) throw new NotFoundError('Version not found')
    return {
      id: result.id,
      version: result.version,
      changelog: result.changelog,
      createdAt: result.createdAt.toISOString(),
    }
  })
}
