import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { JWT } from '@fastify/jwt'
import fastifyPlugin from 'fastify-plugin'
import { UnauthorizedError } from '../http/routes/_errors/index.js'

declare module 'fastify' {
  interface FastifyRequest {
    getCurrentUserId: () => Promise<string>
    jwtVerify<T extends object = { sub: string }>(): Promise<T>
  }
  interface FastifyInstance {
    jwt: JWT
  }
}

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request: FastifyRequest) => {
    request.getCurrentUserId = async () => {
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()
        return sub
      } catch {
        throw new UnauthorizedError('Invalid or expired token')
      }
    }
  })
})
