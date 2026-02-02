import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesService } from '../../../services/smart-notes/context-builder.js'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function previewSmartNotesContext(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/preview-context',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Preview combined context from notes',
        body: z.object({
          systemPromptNoteId: z.string().optional(),
          contextNoteIds: z.array(z.string()).optional(),
          memoryNoteIds: z.array(z.string()).optional(),
        }),
        response: {
          200: z.object({
            preview: z.string(),
          }),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const { systemPromptNoteId, contextNoteIds, memoryNoteIds } = request.body

      const preview = await smartNotesService.previewContext(
        systemPromptNoteId,
        contextNoteIds,
        memoryNoteIds
      )

      return { preview }
    }
  )
}
