import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { JWT } from '@fastify/jwt'
import fastifyPlugin from 'fastify-plugin'
import { createHash } from 'node:crypto'
import { UnauthorizedError } from '../http/errors/index.js'
import { prisma } from '../lib/prisma.js'

export interface ApiKeyInfo {
  id: string
  userId: string
  scopes: string[]
  rateLimit: number | null
  ipWhitelist: string[]
}

declare module 'fastify' {
  interface FastifyRequest {
    getCurrentUserId: () => Promise<string>
    apiKeyInfo?: ApiKeyInfo
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

        // Store API key info for enforcement middleware
        const scopes = Array.isArray(apiKey.scopes) ? apiKey.scopes as string[] : []
        const ipWhitelist = Array.isArray(apiKey.ipWhitelist) ? apiKey.ipWhitelist as string[] : []
        request.apiKeyInfo = {
          id: apiKey.id,
          userId: apiKey.userId,
          scopes,
          rateLimit: apiKey.rateLimit,
          ipWhitelist,
        }

        // Update last used + increment usageCount (fire and forget)
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
        }).catch(() => {})

        return apiKey.userId
      }

      // JWT auth
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()

        // Validate user still exists (cached in Redis for 5min)
        const cacheKey = `jwt:user:${sub}`
        let exists: boolean
        try {
          const { getRedis } = await import('../lib/redis.js')
          const redis = getRedis()
          const cached = await redis.get(cacheKey)
          if (cached === '1') {
            exists = true
          } else if (cached === '0') {
            exists = false
          } else {
            const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, status: true } })
            exists = !!user && user.status !== 'suspended'
            await redis.set(cacheKey, exists ? '1' : '0', 'EX', 300).catch(() => {})
          }
        } catch {
          // Redis unavailable, fallback to DB
          const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, status: true } })
          exists = !!user && user.status !== 'suspended'
        }

        if (!exists) {
          throw new UnauthorizedError('User no longer exists or is suspended')
        }

        return sub
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err
        throw new UnauthorizedError('Invalid or expired token')
      }
    }
  })
})
