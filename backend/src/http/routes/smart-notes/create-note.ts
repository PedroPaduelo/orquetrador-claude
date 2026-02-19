import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function createSmartNote(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Create a Smart Note',
        body: z.object({
          title: z.string().min(1),
          content: z.string().default(''),
          contentType: z.string().optional(),
          folderId: z.string().optional(),
          tags: z.array(z.string()).optional(),
          isPinned: z.boolean().optional(),
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

      const note = await smartNotesMCPClient.createNote(request.body)
      return reply.status(201).send(note)
    }
  )
}
