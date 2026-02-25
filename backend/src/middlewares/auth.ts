import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { JWT } from '@fastify/jwt'
import fastifyPlugin from 'fastify-plugin'
import { createHash } from 'node:crypto'
import { UnauthorizedError } from '../http/errors/index.js'
import { prisma } from '../lib/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    getCurrentUserId: () => Promise<string>
    jwtVerify<T extends object = { sub: string }>(): Promise<T>
  }
  interface FastifyInstance {
    jwt: JWT
  }
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request: FastifyRequest) => {
    request.getCurrentUserId = async () => {
      const authHeader = request.headers.authorization
      if (!authHeader) {
        throw new UnauthorizedError('Missing authorization header')
      }

      // API Key auth: "Bearer exk_..."
      if (authHeader.startsWith('Bearer exk_')) {
        const rawKey = authHeader.replace('Bearer ', '')
        const keyHash = hashKey(rawKey)

        const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } })
        if (!apiKey || apiKey.revoked) {
          throw new UnauthorizedError('Invalid or revoked API key')
        }
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          throw new UnauthorizedError('API key expired')
        }

        // Update last used (fire and forget)
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {})

        return apiKey.userId
      }

      // JWT auth
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()
        return sub
      } catch {
        throw new UnauthorizedError('Invalid or expired token')
      }
    }
  })
})
