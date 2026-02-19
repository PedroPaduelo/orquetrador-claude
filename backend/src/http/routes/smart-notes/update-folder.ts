import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function updateSmartNotesFolder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/smart-notes/folders/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Update a Smart Notes folder',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          parentId: z.string().optional(),
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

      return smartNotesMCPClient.updateFolder(request.params.id, request.body)
    }
  )
}
