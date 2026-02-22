import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function listMessages(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/conversations/:id/messages',
    {
      schema: {
        tags: ['Messages'],
        summary: 'List conversation messages',
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          stepId: z.string().optional(),
        }),
        response: {
          200: z.array(z.object({
            id: z.string(),
            role: z.string(),
            content: z.string(),
            stepId: z.string().nullable(),
            stepName: z.string().nullable(),
            selectedForContext: z.boolean(),
            metadata: z.unknown().nullable(),
            attachments: z.array(z.object({
              id: z.string(),
              filename: z.string(),
              mimeType: z.string(),
              size: z.number(),
              path: z.string(),
              projectPath: z.string(),
              url: z.string(),
            })).optional(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { stepId } = request.query

      const conversation = await prisma.conversation.findUnique({ where: { id } })
      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(stepId && { stepId }),
        },
        include: {
          step: { select: { name: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      return messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        stepId: m.stepId,
        stepName: m.step?.name || null,
        selectedForContext: m.selectedForContext,
        metadata: m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : null,
        attachments: m.attachments && m.attachments.length > 0 ? m.attachments.map(a => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          path: a.path,
          projectPath: a.projectPath,
          url: a.url,
        })) : undefined,
        createdAt: m.createdAt.toISOString(),
      }))
    }
  )
}
