import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function createSmartNotesFolder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/folders',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Create a Smart Notes folder',
        body: z.object({
          name: z.string().min(1),
          icon: z.string().optional(),
          color: z.string().optional(),
          parentId: z.string().optional(),
        }),
        response: {
          201: z.object({}).passthrough(),
        },
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const folder = await smartNotesMCPClient.createFolder(request.body)
      return reply.status(201).send(folder)
    }
  )
}
