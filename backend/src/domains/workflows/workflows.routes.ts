import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { workflowsRepository } from './workflows.repository.js'
import { workflowsService } from './workflows.service.js'
import { NotFoundError } from '../../http/errors/index.js'

const conditionsSchema = z.object({
  rules: z
    .array(
      z.object({
        type: z.enum([
          'contains',
          'not_contains',
          'equals',
          'starts_with',
          'ends_with',
          'regex',
          'length_gt',
          'length_lt',
        ]),
        match: z.string(),
        goto: z.string(),
        maxRetries: z.number().optional(),
        retryMessage: z.string().optional(),
      }),
    )
    .default([]),
  default: z.string().default('next'),
})

const stepSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  baseUrl: z.string().default(''),
  systemPrompt: z.string().nullable().optional(),
  conditions: conditionsSchema
    .nullable()
    .default({ rules: [], default: 'next' })
    .transform((v) => v ?? { rules: [], default: 'next' }),
  maxRetries: z.number().default(0),
  backend: z.enum(['claude', 'api']).default('claude'),
  model: z.string().nullable().optional(),
  dependsOn: z.array(z.string()).default([]),
  validators: z.array(z.unknown()).default([]),
  outputVariables: z.array(z.string()).default([]),
  inputVariables: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  agentIds: z.array(z.string()).default([]),
  ruleIds: z.array(z.string()).default([]),
  hookIds: z.array(z.string()).default([]),
})

const stepResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  stepOrder: z.number(),
  systemPrompt: z.string().nullable(),
  conditions: z.unknown(),
  maxRetries: z.number(),
  backend: z.string(),
  model: z.string().nullable(),
  dependsOn: z.array(z.string()).default([]),
  validators: z.array(z.unknown()).default([]),
  outputVariables: z.array(z.string()).default([]),
  inputVariables: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()),
  skillIds: z.array(z.string()),
  agentIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
  hookIds: z.array(z.string()),
})

export async function workflowsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.post(
    '/workflows',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Create a new workflow',
        body: z.object({
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          type: z.string().default('sequential'),
          steps: z.array(stepSchema).default([]),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const workflow = await workflowsRepository.create(request.body, userId)
      return reply.status(201).send(workflow)
    },
  )

  server.get(
    '/workflows',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'List all workflows',
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              type: z.string(),
              stepsCount: z.number(),
              conversationsCount: z.number(),
              createdAt: z.string(),
              updatedAt: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return workflowsRepository.findAll(userId)
    },
  )

  server.get(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Get workflow by ID with steps',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
            steps: z.array(stepResponseSchema),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const workflow = await workflowsRepository.findById(request.params.id)
      if (!workflow) throw new NotFoundError('Workflow not found')
      return workflow
    },
  )

  server.put(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Update workflow',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          type: z.string().optional(),
          steps: z.array(stepSchema).optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await workflowsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Workflow not found')

      return workflowsRepository.update(request.params.id, request.body)
    },
  )

  server.delete(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Delete workflow',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const existing = await workflowsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Workflow not found')

      await workflowsRepository.delete(request.params.id)
      return reply.status(204).send(null)
    },
  )

  server.post(
    '/workflows/:id/duplicate',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Duplicate a workflow',
        params: z.object({ id: z.string() }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const workflow = await workflowsService.duplicate(request.params.id, userId)
      if (!workflow) throw new NotFoundError('Workflow not found')
      return reply.status(201).send(workflow)
    },
  )
}
