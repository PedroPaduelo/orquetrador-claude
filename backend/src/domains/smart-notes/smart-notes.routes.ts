import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { smartNotesMCPClient } from './mcp-client.js'
import { smartNotesService } from './context-builder.js'
import { BadRequestError, NotFoundError } from '../../http/errors/index.js'

export async function smartNotesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /smart-notes/status
  server.get(
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

  // GET /smart-notes/folders
  server.get(
    '/smart-notes/folders',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'List Smart Notes folders',
        response: {
          200: z.unknown(),
        },
      },
    },
    async () => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      const folders = await smartNotesMCPClient.listFolders()
      return { folders }
    }
  )

  // POST /smart-notes/folders
  server.post(
    '/smart-notes/folders',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Create a Smart Notes folder',
        body: z.object({
          name: z.string().min(1),
          icon: z.string().optional(),
          color: z.string().optional(),
          parentId: z.string().optional(),
        }),
        response: {
          201: z.unknown(),
        },
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      const folder = await smartNotesMCPClient.createFolder(request.body)
      return reply.status(201).send(folder)
    }
  )

  // PUT /smart-notes/folders/:id
  server.put(
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
          200: z.unknown(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      return smartNotesMCPClient.updateFolder(request.params.id, request.body)
    }
  )

  // DELETE /smart-notes/folders/:id
  server.delete(
    '/smart-notes/folders/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Delete a Smart Notes folder',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      await smartNotesMCPClient.deleteFolder(request.params.id)
      return reply.status(204).send(null)
    }
  )

  // GET /smart-notes/notes/search  (must be registered before /notes/:id)
  server.get(
    '/smart-notes/notes/search',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Search Smart Notes',
        querystring: z.object({
          q: z.string().min(1),
        }),
        response: {
          200: z.unknown(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      return smartNotesMCPClient.searchNotes(request.query.q)
    }
  )

  // GET /smart-notes/notes
  server.get(
    '/smart-notes/notes',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'List Smart Notes',
        querystring: z.object({
          folderId: z.string().optional(),
        }),
        response: {
          200: z.unknown(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      return smartNotesMCPClient.listNotes(request.query.folderId)
    }
  )

  // GET /smart-notes/notes/:id
  server.get(
    '/smart-notes/notes/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Get Smart Note by ID',
        params: z.object({ id: z.string() }),
        response: {
          200: z.unknown(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      try {
        return await smartNotesMCPClient.getNote(request.params.id)
      } catch {
        throw new NotFoundError('Note not found')
      }
    }
  )

  // POST /smart-notes/notes
  server.post(
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
          201: z.unknown(),
        },
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      const note = await smartNotesMCPClient.createNote(request.body)
      return reply.status(201).send(note)
    }
  )

  // PUT /smart-notes/notes/:id
  server.put(
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
          200: z.unknown(),
        },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      return smartNotesMCPClient.updateNote(request.params.id, request.body)
    }
  )

  // DELETE /smart-notes/notes/:id
  server.delete(
    '/smart-notes/notes/:id',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Delete a Smart Note',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }

      await smartNotesMCPClient.deleteNote(request.params.id)
      return reply.status(204).send(null)
    }
  )

  // POST /smart-notes/notes/:id/move
  server.post(
    '/smart-notes/notes/:id/move',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Move a Smart Note to a folder',
        params: z.object({ id: z.string() }),
        body: z.object({ folderId: z.string().nullable() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.moveNote(request.params.id, request.body.folderId)
    }
  )

  // POST /smart-notes/notes/:id/archive
  server.post(
    '/smart-notes/notes/:id/archive',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Archive a Smart Note',
        params: z.object({ id: z.string() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.archiveNote(request.params.id)
    }
  )

  // POST /smart-notes/notes/:id/unarchive
  server.post(
    '/smart-notes/notes/:id/unarchive',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Unarchive a Smart Note',
        params: z.object({ id: z.string() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.unarchiveNote(request.params.id)
    }
  )

  // POST /smart-notes/notes/:id/pin
  server.post(
    '/smart-notes/notes/:id/pin',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Pin a Smart Note',
        params: z.object({ id: z.string() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.pinNote(request.params.id)
    }
  )

  // POST /smart-notes/notes/:id/unpin
  server.post(
    '/smart-notes/notes/:id/unpin',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Unpin a Smart Note',
        params: z.object({ id: z.string() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.unpinNote(request.params.id)
    }
  )

  // POST /smart-notes/notes/:id/tags
  server.post(
    '/smart-notes/notes/:id/tags',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Add tag to a Smart Note',
        params: z.object({ id: z.string() }),
        body: z.object({ tagName: z.string().min(1) }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.addTagToNote(request.params.id, request.body.tagName)
    }
  )

  // DELETE /smart-notes/notes/:id/tags/:tagName
  server.delete(
    '/smart-notes/notes/:id/tags/:tagName',
    {
      schema: {
        tags: ['Smart Notes'],
        summary: 'Remove tag from a Smart Note',
        params: z.object({ id: z.string(), tagName: z.string() }),
        response: { 200: z.unknown() },
      },
    },
    async (request) => {
      if (!smartNotesMCPClient.isConfigured()) {
        throw new BadRequestError('Smart Notes nao configurado')
      }
      return smartNotesMCPClient.removeTagFromNote(request.params.id, request.params.tagName)
    }
  )

  // POST /smart-notes/preview-context
  server.post(
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
        throw new BadRequestError('Smart Notes nao configurado')
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
