import type { FastifyInstance, FastifyRequest } from 'fastify'
import rateLimit from '@fastify/rate-limit'

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => {
      // Try to extract userId from JWT
      const authHeader = request.headers.authorization
      if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer exk_')) {
        try {
          const decoded = app.jwt.decode<{ sub: string }>(authHeader.replace('Bearer ', ''))
          if (decoded?.sub) return decoded.sub
        } catch { /* fallback to IP */ }
      }
      return request.ip
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  })
}

export const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
}

export const executionRateLimitConfig = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
}
