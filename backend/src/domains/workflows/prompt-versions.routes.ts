import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { promptVersioningService } from './prompt-versioning.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function promptVersionsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/steps/:stepId/prompt-versions', {
    schema: {
      tags: ['Prompt Versions'],
      params: z.object({ stepId: z.string() }),
    },
  }, async (request) => {
    await request.getCurrentUserId()
    return promptVersioningService.listVersions(request.params.stepId)
  })

  server.post('/steps/:stepId/prompt-versions/rollback', {
    schema: {
      tags: ['Prompt Versions'],
      params: z.object({ stepId: z.string() }),
      body: z.object({ versionId: z.string() }),
    },
  }, async (request) => {
    await request.getCurrentUserId()
    const result = await promptVersioningService.rollback(request.params.stepId, request.body.versionId)
    if (!result) throw new NotFoundError('Version not found')
    return { success: true, restoredVersion: result.version }
  })
}
