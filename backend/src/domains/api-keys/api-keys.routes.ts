import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { randomBytes, createHash } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  const bytes = randomBytes(32)
  return `exk_${bytes.toString('base64url')}`
}

export async function apiKeysRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /api-keys - Generate a new API key
  server.post(
    '/api-keys',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Generate a new API key',
        body: z.object({
          name: z.string().min(1).max(100),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            key: z.string(),
            prefix: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { name } = request.body

      const rawKey = generateApiKey()
      const keyHash = hashKey(rawKey)
      const prefix = rawKey.substring(0, 12)

      const apiKey = await prisma.apiKey.create({
        data: { name, keyHash, prefix, userId },
      })

      return reply.status(201).send({
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt.toISOString(),
      })
    },
  )

  // GET /api-keys - List all API keys for current user
  server.get(
    '/api-keys',
    {
      schema: {
        tags: ['Settings'],
        summary: 'List API keys',
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              prefix: z.string(),
              lastUsedAt: z.string().nullable(),
              createdAt: z.string(),
              revoked: z.boolean(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const keys = await prisma.apiKey.findMany({
        where: { userId, revoked: false },
        orderBy: { createdAt: 'desc' },
      })

      return keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        revoked: k.revoked,
      }))
    },
  )

  // DELETE /api-keys/:id - Revoke an API key
  server.delete(
    '/api-keys/:id',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Revoke an API key',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const { id } = request.params

      await prisma.apiKey.updateMany({
        where: { id, userId },
        data: { revoked: true },
      })

      return reply.status(204).send()
    },
  )
}
