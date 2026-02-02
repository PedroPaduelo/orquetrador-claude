import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'

export async function getSmartNotesStatus(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/smart-notes/status',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Get Smart Notes connection status',
        response: {
          200: z.object({
            configured: z.boolean(),
            connected: z.boolean(),
          }),
        },
      },
    },
    async () => {
      const configured = smartNotesMCPClient.isConfigured()
      let connected = false

      if (configured) {
        try {
          await smartNotesMCPClient.listFolders()
          connected = true
        } catch {
          connected = false
        }
      }

      return { configured, connected }
    }
  )
}
