import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { stepTemplatesRepository } from './step-templates.repository.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function stepTemplatesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/step-templates', {
    schema: { tags: ['Step Templates'], summary: 'List step templates' },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    return stepTemplatesRepository.findAll(userId)
  })

  server.get('/step-templates/:id', {
    schema: {
      tags: ['Step Templates'],
      params: z.object({ id: z.string() }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const t = await stepTemplatesRepository.findById(request.params.id, userId)
    if (!t) throw new NotFoundError('Template not found')
    return t
  })

  server.post('/step-templates', {
    schema: {
      tags: ['Step Templates'],
      body: z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        baseUrl: z.string().optional(),
        systemPrompt: z.string().nullable().optional(),
        conditions: z.string().optional(),
        resourceIds: z.record(z.array(z.string())).optional(),
      }),
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const t = await stepTemplatesRepository.create(request.body, userId)
    return reply.status(201).send(t)
  })

  server.put('/step-templates/:id', {
    schema: {
      tags: ['Step Templates'],
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        baseUrl: z.string().optional(),
        systemPrompt: z.string().nullable().optional(),
        conditions: z.string().optional(),
        resourceIds: z.record(z.array(z.string())).optional(),
      }),
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const existing = await stepTemplatesRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Template not found')
    return stepTemplatesRepository.update(request.params.id, userId, request.body)
  })

  server.delete('/step-templates/:id', {
    schema: {
      tags: ['Step Templates'],
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const existing = await stepTemplatesRepository.findById(request.params.id, userId)
    if (!existing) throw new NotFoundError('Template not found')
    await stepTemplatesRepository.delete(request.params.id)
    return reply.status(204).send(null)
  })
}
