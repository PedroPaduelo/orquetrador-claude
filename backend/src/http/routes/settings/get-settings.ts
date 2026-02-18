import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function getSettings(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/settings',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Get application settings',
        response: {
          200: z.object({
            defaultModel: z.string().nullable(),
            defaultProjectPath: z.string().nullable(),
            claudeBinPath: z.string().nullable(),
          }),
        },
      },
    },
    async () => {
      let settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })

      if (!settings) {
        settings = await prisma.appSettings.create({
          data: { id: 'singleton' },
        })
      }

      return {
        defaultModel: settings.defaultModel,
        defaultProjectPath: settings.defaultProjectPath,
        claudeBinPath: settings.claudeBinPath,
      }
    }
  )
}
