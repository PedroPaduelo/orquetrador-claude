import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { rulesRepository } from './rules.repository.js'
import { rulesService } from './rules.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function rulesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/rules',
    {
      schema: {
        tags: ['Rules'],
        summary: 'List all rules',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            repoOwner: z.string().nullable(),
            repoName: z.string().nullable(),
            lastSyncedAt: z.string().nullable(),
            skillId: z.string().nullable(),
            skillName: z.string().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return rulesRepository.findAll(userId)
    }
  )

  server.post(
    '/rules',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Create a new rule',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          body: z.string().default(''),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
          skillId: z.string().nullable().optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const rule = await rulesRepository.create(request.body, userId)
      return reply.status(201).send({
        id: rule.id,
        name: rule.name,
        createdAt: rule.createdAt,
      })
    }
  )

  server.get(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Get rule by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            body: z.string(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            skillId: z.string().nullable(),
            skillName: z.string().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const rule = await rulesRepository.findById(request.params.id, userId)
      if (!rule) throw new NotFoundError('Rule not found')
      return rule
    }
  )

  server.put(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Update rule',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          body: z.string().optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
          skillId: z.string().nullable().optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const existing = await rulesRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Rule not found')

      const rule = await rulesRepository.update(request.params.id, userId, request.body)
      return { id: rule.id, name: rule.name, updatedAt: rule.updatedAt }
    }
  )

  server.delete(
    '/rules/:id',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Delete rule',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const existing = await rulesRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Rule not found')

      await rulesRepository.delete(request.params.id, userId)
      return reply.status(204).send(null)
    }
  )

  server.patch(
    '/rules/:id/toggle',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Toggle rule enabled state',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ id: z.string(), enabled: z.boolean() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const existing = await rulesRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Rule not found')

      return rulesRepository.toggle(request.params.id, userId, existing.enabled)
    }
  )

  server.post(
    '/rules/import',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Import a rule from a URL (raw .md) or pasted markdown content',
        body: z.object({
          url: z.string().url().optional(),
          content: z.string().optional(),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { url, content, isGlobal } = request.body

      if (!url && !content) throw new Error('Informe url ou content')

      const rule = url
        ? await rulesService.importFromUrl(url, isGlobal, userId)
        : await rulesService.importFromContent(content!, isGlobal, undefined, userId)

      return reply.status(201).send({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        createdAt: rule.createdAt,
      })
    }
  )

  server.post(
    '/rules/:id/resync',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Re-sync an imported rule from its GitHub source',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            lastSyncedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const result = await rulesService.resync(request.params.id, userId)
      if (!result) throw new NotFoundError('Rule not found')
      return result
    }
  )
}
