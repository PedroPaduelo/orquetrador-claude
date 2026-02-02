import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function listSmartNotesFolders(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/smart-notes/folders',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'List Smart Notes folders',
        response: {
          200: z.object({
            folders: z.array(z.object({
              id: z.string(),
              name: z.string(),
              icon: z.string().optional(),
              color: z.string().optional(),
              noteCount: z.number().optional(),
            })),
          }),
        },
      },
    },
    async () => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      return smartNotesMCPClient.listFolders()
    }
  )
}
