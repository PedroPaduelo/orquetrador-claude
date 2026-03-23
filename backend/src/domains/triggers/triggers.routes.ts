import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { triggersRepository } from './triggers.repository.js'
import { triggersService } from './triggers.service.js'
import { NotFoundError, BadRequestError } from '../../http/errors/index.js'
import { paginationSchema } from '../../lib/pagination.js'

const triggerTypeEnum = z.enum(['manual', 'cron', 'webhook_inbound', 'event', 'git_push'])

const createTriggerBody = z.object({
  type: triggerTypeEnum,
  cronExpr: z.string().optional(),
  cronTimezone: z.string().optional(),
  eventName: z.string().optional(),
  eventFilter: z.any().optional(),
  rateLimit: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
})

const updateTriggerBody = z.object({
  cronExpr: z.string().optional(),
  cronTimezone: z.string().optional(),
  eventName: z.string().optional(),
  eventFilter: z.any().optional(),
  rateLimit: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
})

export async function triggersRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/workflows/:workflowId/triggers', {
    schema: {
      tags: ['Triggers'],
      summary: 'List triggers for a workflow (paginated)',
      params: z.object({ workflowId: z.string() }),
      querystring: paginationSchema,
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const result = await triggersRepository.findAllPaginated(
      request.params.workflowId, userId, request.query,
    )
    if (!result) throw new NotFoundError('Workflow not found')
    return result
  })

  server.get('/triggers/:id', {
    schema: {
      tags: ['Triggers'],
      summary: 'Get a single trigger',
      params: z.object({ id: z.string() }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const trigger = await triggersRepository.findById(request.params.id, userId)
    if (!trigger) throw new NotFoundError('Trigger not found')
    return trigger
  })

  server.post('/workflows/:workflowId/triggers', {
    schema: {
      tags: ['Triggers'],
      summary: 'Create a trigger for a workflow',
      params: z.object({ workflowId: z.string() }),
      body: createTriggerBody,
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const { type, cronExpr } = request.body

    if (type === 'cron' && !cronExpr) {
      throw new BadRequestError('cronExpr is required for cron triggers')
    }
    if (type === 'event' && !request.body.eventName) {
      throw new BadRequestError('eventName is required for event triggers')
    }

    const input: Record<string, unknown> = { ...request.body }
    if (type === 'webhook_inbound') {
      const { randomBytes } = await import('node:crypto')
      input.webhookSecret = randomBytes(32).toString('hex')
    }

    const trigger = await triggersRepository.create(
      request.params.workflowId, userId, input as any,
    )
    if (!trigger) throw new NotFoundError('Workflow not found')
    return reply.status(201).send(trigger)
  })

  server.put('/triggers/:id', {
    schema: {
      tags: ['Triggers'],
      summary: 'Update a trigger',
      params: z.object({ id: z.string() }),
      body: updateTriggerBody,
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const existing = await triggersRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Trigger not found')
    const updated = await triggersRepository.update(request.params.id, userId, request.body)
    if (!updated) throw new NotFoundError('Trigger not found')
    return updated
  })

  server.delete('/triggers/:id', {
    schema: {
      tags: ['Triggers'],
      summary: 'Delete a trigger',
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const existing = await triggersRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Trigger not found')
    await triggersRepository.delete(request.params.id, userId)
    return reply.status(204).send(null)
  })

  server.get('/triggers/:id/scheduled', {
    schema: {
      tags: ['Triggers'],
      summary: 'List scheduled executions for a trigger',
      params: z.object({ id: z.string() }),
      querystring: paginationSchema,
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const result = await triggersRepository.findScheduledByTrigger(
      request.params.id, userId, request.query,
    )
    if (!result) throw new NotFoundError('Trigger not found')
    return result
  })

  server.post('/triggers/:id/fire', {
    schema: {
      tags: ['Triggers'],
      summary: 'Manually fire a trigger',
      params: z.object({ id: z.string() }),
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const trigger = await triggersRepository.findById(request.params.id, userId)
    if (!trigger) throw new NotFoundError('Trigger not found')
    if (!trigger.enabled) throw new BadRequestError('Trigger is disabled')
    const scheduled = await triggersService.fireNow(request.params.id)
    return reply.status(201).send(scheduled)
  })
}
