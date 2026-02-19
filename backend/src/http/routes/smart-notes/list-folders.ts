import type { FastifyInstance } from 'fastify'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function listSmartNotesFolders(app: FastifyInstance) {
  app.get(
    '/smart-notes/folders',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'List Smart Notes folders',
      },
    },
    async () => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }

      const folders = await smartNotesMCPClient.listFolders()
      return { folders }
    }
  )
}
