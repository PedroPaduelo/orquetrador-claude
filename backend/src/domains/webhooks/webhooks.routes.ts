import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { webhooksRepository } from './webhooks.repository.js'
import { webhooksService } from './webhooks.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function webhooksRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/webhooks', {
    schema: { tags: ['Webhooks'], summary: 'List webhooks' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    return webhooksRepository.findAll(userId)
  })

  server.get('/webhooks/:id', {
    schema: {
      tags: ['Webhooks'],
      params: z.object({ id: z.string() }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const w = await webhooksRepository.findById(request.params.id, userId)
    if (!w) throw new NotFoundError('Webhook not found')
    return w
  })

  server.post('/webhooks', {
    schema: {
      tags: ['Webhooks'],
      body: z.object({
        url: z.string().url(),
        events: z.array(z.string()).min(1),
        enabled: z.boolean().optional(),
      }),
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const secret = webhooksService.generateSecret()
    const w = await webhooksRepository.create({ ...request.body, secret }, userId)
    return reply.status(201).send({ ...w, secret })
  })

  server.put('/webhooks/:id', {
    schema: {
      tags: ['Webhooks'],
      params: z.object({ id: z.string() }),
      body: z.object({
        url: z.string().url().optional(),
        events: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
      }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const existing = await webhooksRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Webhook not found')
    return webhooksRepository.update(request.params.id, userId, request.body)
  })

  server.delete('/webhooks/:id', {
    schema: {
      tags: ['Webhooks'],
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const existing = await webhooksRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Webhook not found')
    await webhooksRepository.delete(request.params.id, userId)
    return reply.status(204).send(null)
  })

  server.get('/webhooks/:id/deliveries', {
    schema: {
      tags: ['Webhooks'],
      params: z.object({ id: z.string() }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const existing = await webhooksRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Webhook not found')
    const deliveries = await webhooksRepository.getDeliveries(request.params.id)
    return deliveries.map(d => ({
      id: d.id,
      status: d.status,
      responseCode: d.responseCode,
      attempts: d.attempts,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
    }))
  })

  server.post('/webhooks/:id/test', {
    schema: {
      tags: ['Webhooks'],
      params: z.object({ id: z.string() }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const webhook = await webhooksRepository.findById(request.params.id, userId)
    if (!webhook) throw new NotFoundError('Webhook not found')
    await webhooksService.dispatch('test', { message: 'Test webhook delivery' }, userId)
    return { success: true }
  })
}
