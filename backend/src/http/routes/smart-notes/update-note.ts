import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function updateSmartNote(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/smart-notes/notes/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Update a Smart Note',
        params: z.object({ id: z.string() }),
        body: z.object({
          title: z.string().optional(),
          content: z.string().optional(),
          tags: z.array(z.string()).optional(),
        }),
        response: {
          200: z.object({}).passthrough(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      return smartNotesMCPClient.updateNote(request.params.id, request.body)
    }
  )
}
