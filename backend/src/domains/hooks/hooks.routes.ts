import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { hooksRepository } from './hooks.repository.js'
import { hooksService } from './hooks.service.js'
import { NotFoundError } from '../../http/errors/index.js'

const hookResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  eventType: z.string(),
  matcher: z.string().nullable(),
  handlerType: z.string(),
  command: z.string().nullable(),
  prompt: z.string().nullable(),
  timeout: z.number(),
  isAsync: z.boolean(),
  statusMessage: z.string().nullable(),
  enabled: z.boolean(),
  isGlobal: z.boolean(),
  projectPath: z.string().nullable(),
  isTemplate: z.boolean(),
  templateId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export async function hooksRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // List all hooks
  server.get(
    '/hooks',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'List all hooks',
        response: {
          200: z.array(hookResponseSchema),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return hooksRepository.findAll(userId)
    }
  )

  // Get templates (BEFORE :id routes)
  server.get(
    '/hooks/templates',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'List available hook templates',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            eventType: z.string(),
            matcher: z.string().nullable(),
            handlerType: z.string(),
            command: z.string().nullable(),
            prompt: z.string().nullable(),
            timeout: z.number(),
            isAsync: z.boolean(),
            statusMessage: z.string().nullable(),
          })),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      return hooksService.getTemplates()
    }
  )

  // Get events metadata (BEFORE :id routes)
  server.get(
    '/hooks/events',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'List all hook event types with metadata',
        response: {
          200: z.array(z.object({
            value: z.string(),
            label: z.string(),
            description: z.string(),
            supportsMatcher: z.boolean(),
            matcherLabel: z.string().optional(),
            matcherHint: z.string().optional(),
            category: z.string(),
          })),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      return hooksService.getEvents()
    }
  )

  // Create from template (BEFORE :id routes)
  server.post(
    '/hooks/from-template',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Create hook from template',
        body: z.object({
          templateId: z.string().min(1),
        }),
        response: {
          201: hookResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const hook = await hooksService.createFromTemplate(request.body.templateId, userId)
      return reply.status(201).send(hook)
    }
  )

  // Preview hooks config JSON (BEFORE :id routes)
  server.post(
    '/hooks/preview',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Generate .claude/settings.json hooks config preview',
        body: z.object({
          hookIds: z.array(z.string()).optional(),
        }),
        response: {
          200: z.object({ config: z.string() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const allHooks = await hooksRepository.findAll(userId)
      const { hookIds } = request.body

      const selected = hookIds
        ? allHooks.filter(h => hookIds.includes(h.id))
        : allHooks

      return { config: hooksService.generatePreview(selected) }
    }
  )

  // Create hook
  server.post(
    '/hooks',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Create a new hook',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          eventType: z.string().min(1),
          matcher: z.string().nullable().optional(),
          handlerType: z.enum(['command', 'prompt', 'agent']).default('command'),
          command: z.string().nullable().optional(),
          prompt: z.string().nullable().optional(),
          timeout: z.number().default(60000),
          isAsync: z.boolean().default(false),
          statusMessage: z.string().nullable().optional(),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
          projectPath: z.string().nullable().optional(),
          templateId: z.string().nullable().optional(),
        }),
        response: {
          201: hookResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const hook = await hooksRepository.create(request.body, userId)
      return reply.status(201).send(hook)
    }
  )

  // Get hook by ID
  server.get(
    '/hooks/:id',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Get hook by ID',
        params: z.object({ id: z.string() }),
        response: { 200: hookResponseSchema },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const hook = await hooksRepository.findById(request.params.id)
      if (!hook) throw new NotFoundError('Hook not found')
      return hook
    }
  )

  // Update hook
  server.put(
    '/hooks/:id',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Update hook',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          eventType: z.string().optional(),
          matcher: z.string().nullable().optional(),
          handlerType: z.enum(['command', 'prompt', 'agent']).optional(),
          command: z.string().nullable().optional(),
          prompt: z.string().nullable().optional(),
          timeout: z.number().optional(),
          isAsync: z.boolean().optional(),
          statusMessage: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
          projectPath: z.string().nullable().optional(),
        }),
        response: {
          200: hookResponseSchema,
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await hooksRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Hook not found')
      return hooksRepository.update(request.params.id, request.body)
    }
  )

  // Delete hook
  server.delete(
    '/hooks/:id',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Delete hook',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const existing = await hooksRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Hook not found')
      await hooksRepository.delete(request.params.id)
      return reply.status(204).send(null)
    }
  )

  // Toggle hook enabled
  server.patch(
    '/hooks/:id/toggle',
    {
      schema: {
        tags: ['Hooks'],
        summary: 'Toggle hook enabled state',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ id: z.string(), enabled: z.boolean() }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await hooksRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Hook not found')
      return hooksRepository.toggle(request.params.id, existing.enabled)
    }
  )
}
