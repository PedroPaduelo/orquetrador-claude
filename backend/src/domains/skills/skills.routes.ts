import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { skillsRepository } from './skills.repository.js'
import { skillsService } from './skills.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function skillsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /skills
  server.get(
    '/skills',
    {
      schema: {
        tags: ['Skills'],
        summary: 'List all skills',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            allowedTools: z.array(z.string()),
            model: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            pluginId: z.string().nullable(),
            source: z.string(),
            repoUrl: z.string().nullable(),
            repoOwner: z.string().nullable(),
            repoName: z.string().nullable(),
            repoBranch: z.string().nullable(),
            repoPath: z.string().nullable(),
            lastSyncedAt: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async () => skillsRepository.findAll()
  )

  // POST /skills
  server.post(
    '/skills',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Create a new skill',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          body: z.string().default(''),
          allowedTools: z.array(z.string()).default([]),
          model: z.string().optional(),
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
      const skill = await skillsRepository.create(request.body)
      return reply.status(201).send({
        id: skill.id,
        name: skill.name,
        createdAt: skill.createdAt,
      })
    }
  )

  // GET /skills/:id
  server.get(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Get skill by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            body: z.string(),
            allowedTools: z.array(z.string()),
            model: z.string().nullable(),
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
      const skill = await skillsRepository.findById(request.params.id)
      if (!skill) throw new NotFoundError('Skill not found')
      return skill
    }
  )

  // PUT /skills/:id
  server.put(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Update skill',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          body: z.string().optional(),
          allowedTools: z.array(z.string()).optional(),
          model: z.string().nullable().optional(),
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
      const existing = await skillsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Skill not found')

      const skill = await skillsRepository.update(request.params.id, request.body)
      return { id: skill.id, name: skill.name, updatedAt: skill.updatedAt }
    }
  )

  // DELETE /skills/:id
  server.delete(
    '/skills/:id',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Delete skill',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const existing = await skillsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Skill not found')

      await skillsRepository.delete(request.params.id)
      return reply.status(204).send(null)
    }
  )

  // PATCH /skills/:id/toggle
  server.patch(
    '/skills/:id/toggle',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Toggle skill enabled state',
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
      const existing = await skillsRepository.findById(request.params.id)
      if (!existing) throw new NotFoundError('Skill not found')

      return skillsRepository.toggle(request.params.id, existing.enabled)
    }
  )

  // POST /skills/import
  server.post(
    '/skills/import',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Import a skill from a URL (raw SKILL.md) or pasted markdown content',
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
      const { url, content, isGlobal } = request.body

      if (!url && !content) {
        throw new Error('Informe url ou content')
      }

      let skill
      if (url) {
        skill = await skillsService.importFromUrl(url, isGlobal)
      } else {
        skill = await skillsService.importFromContent(content!, isGlobal)
      }

      return reply.status(201).send({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        createdAt: skill.createdAt,
      })
    }
  )

  // POST /skills/:id/resync
  server.post(
    '/skills/:id/resync',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Re-sync an imported skill from its GitHub source',
        params: z.object({ id: z.string() }),
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
      const result = await skillsService.resync(request.params.id)
      if (!result) throw new NotFoundError('Skill not found')
      return result
    }
  )
}
