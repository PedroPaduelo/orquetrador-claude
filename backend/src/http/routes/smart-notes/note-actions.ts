import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from '../../../services/smart-notes/mcp-client.js'
import { BadRequestError } from '../_errors/index.js'

export async function smartNoteActions(app: FastifyInstance) {
  const noteParamsSchema = z.object({ id: z.string() })
  const noteResponse = { 200: z.object({}).passthrough() }

  // Move note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/move',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Move a Smart Note to a folder',
        params: noteParamsSchema,
        body: z.object({ folderId: z.string().nullable() }),
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.moveNote(request.params.id, request.body.folderId)
    }
  )

  // Archive note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/archive',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Archive a Smart Note',
        params: noteParamsSchema,
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.archiveNote(request.params.id)
    }
  )

  // Unarchive note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/unarchive',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Unarchive a Smart Note',
        params: noteParamsSchema,
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.unarchiveNote(request.params.id)
    }
  )

  // Pin note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/pin',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Pin a Smart Note',
        params: noteParamsSchema,
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.pinNote(request.params.id)
    }
  )

  // Unpin note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/unpin',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Unpin a Smart Note',
        params: noteParamsSchema,
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.unpinNote(request.params.id)
    }
  )

  // Add tag to note
  app.withTypeProvider<ZodTypeProvider>().post(
    '/smart-notes/notes/:id/tags',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Add tag to a Smart Note',
        params: z.object({ id: z.string() }),
        body: z.object({ tagName: z.string().min(1) }),
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.addTagToNote(request.params.id, request.body.tagName)
    }
  )

  // Remove tag from note
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/smart-notes/notes/:id/tags/:tagName',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Remove tag from a Smart Note',
        params: z.object({ id: z.string(), tagName: z.string() }),
        response: noteResponse,
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes is not configured')
      }
      return smartNotesMCPClient.removeTagFromNote(request.params.id, request.params.tagName)
    }
  )
}
