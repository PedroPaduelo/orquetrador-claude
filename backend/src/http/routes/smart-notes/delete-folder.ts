import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function deleteSmartNotesFolder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/smart-notes/folders/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Delete a Smart Notes folder',
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      await smartNotesMCPClient.deleteFolder(request.params.id)
      return reply.status(204).send()
    }
  )
}
