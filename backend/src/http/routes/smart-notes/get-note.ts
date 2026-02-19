import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError, NotFoundError } from '../_errors/index.js'

export async function getSmartNote(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/smart-notes/notes/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Get Smart Note by ID',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const { id } = request.params

      try {
        return await smartNotesMCPClient.getNote(id)
      } catch {
        throw new NotFoundError('Note not found')
      }
    }
  )
}
