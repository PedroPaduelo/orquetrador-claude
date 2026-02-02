import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listConversations(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/conversations',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'List conversations',
        querystring: z.object({
          workflowId: z.string().optional(),
        }),
        response: {
          200: z.array(z.object({
            id: z.string(),
            title: z.string().nullable(),
            workflowId: z.string(),
            workflowName: z.string(),
            workflowType: z.string(),
            currentStepId: z.string().nullable(),
            currentStepName: z.string().nullable(),
            messagesCount: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const { workflowId } = request.query

      const conversations = await prisma.conversation.findMany({
        where: workflowId ? { workflowId } : undefined,
        include: {
          workflow: {
            select: { name: true, type: true },
          },
          currentStep: {
            select: { name: true },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      return conversations.map((c) => ({
        id: c.id,
        title: c.title,
        workflowId: c.workflowId,
        workflowName: c.workflow.name,
        workflowType: c.workflow.type,
        currentStepId: c.currentStepId,
        currentStepName: c.currentStep?.name || null,
        messagesCount: c._count.messages,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    }
  )
}
