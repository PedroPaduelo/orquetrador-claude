import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function listSmartNotes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/smart-notes/notes',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'List Smart Notes',
        querystring: z.object({
          folderId: z.string().optional(),
        }),
        response: {
          200: z.object({
            notes: z.array(z.object({
              id: z.string(),
              title: z.string(),
              contentPreview: z.string().optional(),
              folderId: z.string().optional(),
            })),
          }),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const { folderId } = request.query
      return smartNotesMCPClient.listNotes(folderId)
    }
  )
}
