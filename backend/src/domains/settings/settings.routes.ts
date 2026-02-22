import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

export async function settingsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
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

  server.put(
    '/settings',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Update application settings',
        body: z.object({
          defaultModel: z.string().nullable().optional(),
          defaultProjectPath: z.string().nullable().optional(),
          claudeBinPath: z.string().nullable().optional(),
        }),
        response: {
          200: z.object({
            defaultModel: z.string().nullable(),
            defaultProjectPath: z.string().nullable(),
            claudeBinPath: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const { defaultModel, defaultProjectPath, claudeBinPath } = request.body

      const settings = await prisma.appSettings.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          defaultModel,
          defaultProjectPath,
          claudeBinPath,
        },
        update: {
          ...(defaultModel !== undefined && { defaultModel }),
          ...(defaultProjectPath !== undefined && { defaultProjectPath }),
          ...(claudeBinPath !== undefined && { claudeBinPath }),
        },
      })

      return {
        defaultModel: settings.defaultModel,
        defaultProjectPath: settings.defaultProjectPath,
        claudeBinPath: settings.claudeBinPath,
      }
    }
  )
}
