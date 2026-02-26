import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { mcpServersRepository } from './mcp-servers.repository.js'
import { mcpServersService } from './mcp-servers.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function mcpServersRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/mcp-servers',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'List all MCP servers',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            uri: z.string().nullable(),
            command: z.string().nullable(),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            lastTestAt: z.string().nullable(),
            lastTestOk: z.boolean().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return mcpServersRepository.findAll(userId)
    }
  )

  server.post(
    '/mcp-servers',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Create a new MCP server',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(['http', 'sse', 'stdio']).default('http'),
          uri: z.string().optional(),
          command: z.string().optional(),
          args: z.array(z.string()).default([]),
          envVars: z.record(z.string()).default({}),
          enabled: z.boolean().default(true),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const s = await mcpServersRepository.create(request.body, userId)
      return reply.status(201).send({
        id: s.id,
        name: s.name,
        type: s.type,
        createdAt: s.createdAt,
      })
    }
  )

  server.get(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Get MCP server by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            uri: z.string().nullable(),
            command: z.string().nullable(),
            args: z.array(z.string()),
            envVars: z.record(z.string()),
            enabled: z.boolean(),
            isGlobal: z.boolean(),
            toolsCache: z.unknown().nullable(),
            lastTestAt: z.string().nullable(),
            lastTestOk: z.boolean().nullable(),
            pluginId: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const s = await mcpServersRepository.findById(request.params.id, userId)
      if (!s) throw new NotFoundError('MCP Server not found')
      return s
    }
  )

  server.put(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Update MCP server',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          type: z.enum(['http', 'sse', 'stdio']).optional(),
          uri: z.string().optional(),
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          envVars: z.record(z.string()).optional(),
          enabled: z.boolean().optional(),
          isGlobal: z.boolean().optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const existing = await mcpServersRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('MCP Server not found')

      const s = await mcpServersRepository.update(request.params.id, userId, request.body)
      return { id: s.id, name: s.name, type: s.type, updatedAt: s.updatedAt }
    }
  )

  server.delete(
    '/mcp-servers/:id',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Delete MCP server',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const existing = await mcpServersRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('MCP Server not found')

      await mcpServersRepository.delete(request.params.id, userId)
      return reply.status(204).send(null)
    }
  )

  server.patch(
    '/mcp-servers/:id/toggle',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Toggle MCP server enabled state',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ id: z.string(), enabled: z.boolean() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const existing = await mcpServersRepository.findById(request.params.id, userId)
      if (!existing) throw new NotFoundError('MCP Server not found')

      return mcpServersRepository.toggle(request.params.id, userId, existing.enabled)
    }
  )

  server.post(
    '/mcp-servers/:id/test',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Test MCP server connection and fetch tools',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            ok: z.boolean(),
            tools: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
            })).optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const result = await mcpServersService.test(request.params.id, userId)
      if (!result) throw new NotFoundError('MCP Server not found')
      return result
    }
  )

  server.post(
    '/mcp-servers/quick-install',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Quick install MCP server from a command string (e.g. npx -y @mcp/server)',
        body: z.object({
          command: z.string().min(1, 'Comando obrigatorio'),
          name: z.string().optional(),
          description: z.string().optional(),
          envVars: z.record(z.string()).default({}),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            command: z.string().nullable(),
            args: z.array(z.string()),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const s = await mcpServersService.quickInstall(request.body, userId)
      return reply.status(201).send({
        id: s.id,
        name: s.name,
        type: s.type,
        command: s.command,
        args: s.args,
        createdAt: s.createdAt,
      })
    }
  )
}
