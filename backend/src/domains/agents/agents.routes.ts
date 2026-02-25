import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { agentsRepository } from './agents.repository.js'
import { agentsService } from './agents.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function agentsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/agents',
    {
      schema: {
        tags: ['Agents'],
        summary: 'List all agents',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            model: z.string().nullable(),
            permissionMode: z.string(),
            maxTurns: z.number().nullable(),
            tools: z.array(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            repoOwner: z.string().nullable(),
            repoName: z.string().nullable(),
            lastSyncedAt: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return agentsRepository.findAll(userId)
    }
  )

  server.post(
    '/agents',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Create a new agent',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          systemPrompt: z.string().default(''),
          tools: z.array(z.string()).default([]),
          disallowedTools: z.array(z.string()).default([]),
          model: z.string().optional(),
          permissionMode: z.string().default('default'),
          maxTurns: z.number().optional(),
          skills: z.array(z.string()).default([]),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
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
      const agent = await agentsRepository.create(request.body, userId)
      return reply.status(201).send({
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
      })
    }
  )

  server.get(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Get agent by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            systemPrompt: z.string(),
            tools: z.array(z.string()),
            disallowedTools: z.array(z.string()),
            model: z.string().nullable(),
            permissionMode: z.string(),
            maxTurns: z.number().nullable(),
            skills: z.array(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const agent = await agentsRepository.findById(request.params.id)
      if (!agent) throw new NotFoundError('Agent not found')
      return agent
    }
  )

  server.put(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Update agent',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          tools: z.array(z.string()).optional(),
          disallowedTools: z.array(z.string()).optional(),
          model: z.string().nullable().optional(),
          permissionMode: z.string().optional(),
          maxTurns: z.number().nullable().optional(),
          skills: z.array(z.string()).optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
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
      await request.getCurrentUserId()
      const existing = await agentsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Agent not found')

      const agent = await agentsRepository.update(request.params.id, request.body)
      return { id: agent.id, name: agent.name, updatedAt: agent.updatedAt }
    }
  )

  server.delete(
    '/agents/:id',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Delete agent',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const existing = await agentsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Agent not found')

      await agentsRepository.delete(request.params.id)
      return reply.status(204).send(null)
    }
  )

  server.patch(
    '/agents/:id/toggle',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Toggle agent enabled state',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ id: z.string(), enabled: z.boolean() }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await agentsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Agent not found')

      return agentsRepository.toggle(request.params.id, existing.enabled)
    }
  )

  server.post(
    '/agents/import',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Import an agent from a URL (raw agent.md) or pasted markdown content',
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

      const agent = url
        ? await agentsService.importFromUrl(url, isGlobal, userId)
        : await agentsService.importFromContent(content!, isGlobal, undefined, userId)

      return reply.status(201).send({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        createdAt: agent.createdAt,
      })
    }
  )

  server.post(
    '/agents/:id/resync',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Re-sync an imported agent from its GitHub source',
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
      await request.getCurrentUserId()
      const result = await agentsService.resync(request.params.id)
      if (!result) throw new NotFoundError('Agent not found')
      return result
    }
  )
}
