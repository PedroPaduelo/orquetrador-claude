import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { uploadService } from './upload-service.js'
import { prisma } from '../../lib/prisma.js'

export async function attachmentsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /conversations/:id/attachments
  server.post(
    '/conversations/:id/attachments',
    {
      schema: {
        tags: ['Attachments'],
        summary: 'Upload image attachments to a conversation',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            files: z.array(z.object({
              id: z.string(),
              filename: z.string(),
              mimeType: z.string(),
              size: z.number(),
              path: z.string(),
              projectPath: z.string(),
              url: z.string(),
            })),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id: conversationId } = request.params

      // Get projectPath from conversation's workflow relation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          workflow: { select: { projectPath: true } },
        },
      })

      const projectPath = conversation?.workflow?.projectPath || undefined

      try {
        const parts = request.files()
        const results = []

        for await (const part of parts) {
          const buffer = await part.toBuffer()
          const result = await uploadService.uploadImage({
            conversationId,
            projectPath,
            file: {
              filename: part.filename || 'image.png',
              mimeType: part.mimetype,
              data: buffer,
            },
          })
          results.push(result)
        }

        if (results.length === 0) {
          return reply.status(400).send({ message: 'Nenhum arquivo enviado' })
        }

        return reply.send({ files: results })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao fazer upload'
        return reply.status(400).send({ message })
      }
    }
  )
}
