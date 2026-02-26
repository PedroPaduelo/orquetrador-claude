import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { pluginsRepository } from './plugins.repository.js'
import { pluginsService } from './plugins.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function pluginsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /plugins
  server.get(
    '/plugins',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'List all plugins',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            version: z.string().nullable(),
            author: z.string().nullable(),
            enabled: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            mcpServersCount: z.number(),
            skillsCount: z.number(),
            agentsCount: z.number(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return pluginsRepository.findAll(userId)
    }
  )

  // POST /plugins/import-url  (must be before /plugins/:id to avoid route conflict)
  server.post(
    '/plugins/import-url',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Import a plugin from a GitHub repo URL or direct JSON manifest URL',
        body: z.object({
          url: z.string().url(),
          projectPath: z.string().optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            source: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { url, projectPath } = request.body
      const plugin = await pluginsService.importFromUrl(url, projectPath, userId)
      return reply.status(201).send({
        id: plugin.id,
        name: plugin.name,
        source: plugin.source,
        createdAt: plugin.createdAt,
      })
    }
  )

  // POST /plugins
  server.post(
    '/plugins',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Install a plugin from a manifest object',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          version: z.string().optional(),
          author: z.string().optional(),
          manifest: z.object({
            mcpServers: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              type: z.string(),
              uri: z.string().optional(),
              command: z.string().optional(),
              args: z.array(z.string()).default([]),
              envVars: z.record(z.string()).default({}),
            })).default([]),
            skills: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              body: z.string().default(''),
              allowedTools: z.array(z.string()).default([]),
              model: z.string().optional(),
            })).default([]),
            agents: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              systemPrompt: z.string().default(''),
              tools: z.array(z.string()).default([]),
              disallowedTools: z.array(z.string()).default([]),
              model: z.string().optional(),
              permissionMode: z.string().default('default'),
              maxTurns: z.number().optional(),
              skills: z.array(z.string()).default([]),
            })).default([]),
          }),
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
      const { name, description, version, author, manifest } = request.body
      const plugin = await pluginsService.install({
        name,
        description,
        version,
        author,
        ...manifest,
      }, userId)
      return reply.status(201).send({
        id: plugin.id,
        name: plugin.name,
        createdAt: plugin.createdAt,
      })
    }
  )

  // GET /plugins/:id
  server.get(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Get plugin by ID with children',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            version: z.string().nullable(),
            author: z.string().nullable(),
            enabled: z.boolean(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            projectPath: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
            mcpServers: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              enabled: z.boolean(),
            })),
            skills: z.array(z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              enabled: z.boolean(),
            })),
            agents: z.array(z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              enabled: z.boolean(),
            })),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const plugin = await pluginsRepository.findById(request.params.id, userId)
      if (!plugin) throw new NotFoundError('Plugin not found')
      return plugin
    }
  )

  // PUT /plugins/:id
  server.put(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Update plugin metadata',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          version: z.string().nullable().optional(),
          author: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
          projectPath: z.string().nullable().optional(),
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
      const existing = await pluginsRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Plugin not found')

      const plugin = await pluginsRepository.update(request.params.id, userId, request.body)
      return { id: plugin.id, name: plugin.name, updatedAt: plugin.updatedAt }
    }
  )

  // DELETE /plugins/:id
  server.delete(
    '/plugins/:id',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Uninstall plugin and cascade-delete children',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const existing = await pluginsRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Plugin not found')

      await pluginsRepository.delete(request.params.id, userId)
      return reply.status(204).send(null)
    }
  )

  // PATCH /plugins/:id/toggle
  server.patch(
    '/plugins/:id/toggle',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Toggle plugin enabled state and cascade to children',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            enabled: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const existing = await pluginsRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('Plugin not found')

      return pluginsRepository.toggle(request.params.id, userId, existing.enabled)
    }
  )

  // POST /plugins/:id/resync
  server.post(
    '/plugins/:id/resync',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Re-sync plugin from its GitHub source repo',
        params: z.object({ id: z.string() }),
        body: z.object({
          projectPath: z.string().optional(),
        }).default({}),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            filesUpdated: z.number(),
            lastSyncedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const result = await pluginsService.resync(request.params.id, userId, request.body.projectPath)
      if (!result) throw new NotFoundError('Plugin not found')
      return result
    }
  )
}
