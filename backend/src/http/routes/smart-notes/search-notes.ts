import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function searchSmartNotes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/smart-notes/notes/search',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Search Smart Notes',
        querystring: z.object({
          q: z.string().min(1),
        }),
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const { q } = request.query
      return smartNotesMCPClient.searchNotes(q)
    }
  )
}
