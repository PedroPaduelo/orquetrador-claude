import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function healthCheck(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        response: {
          200: z.object({
            status: z.string(),
            timestamp: z.string(),
            database: z.string(),
          }),
        },
      },
    },
    async () => {
      let dbStatus = 'disconnected'

      try {
        await prisma.$queryRaw`SELECT 1`
        dbStatus = 'connected'
      } catch {
        dbStatus = 'error'
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
      }
    }
  )
}
