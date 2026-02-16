import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function getConversation(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/conversations/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get conversation with messages',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            title: z.string().nullable(),
            workflowId: z.string(),
            workflow: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              projectPath: z.string().nullable(),
              steps: z.array(z.object({
                id: z.string(),
                name: z.string(),
                stepOrder: z.number(),
              })),
            }),
            currentStepId: z.string().nullable(),
            currentStepIndex: z.number(),
            messages: z.array(z.object({
              id: z.string(),
              role: z.string(),
              content: z.string(),
              stepId: z.string().nullable(),
              stepName: z.string().nullable(),
              selectedForContext: z.boolean(),
              metadata: z.unknown().nullable(),
              createdAt: z.string(),
            })),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          workflow: {
            include: {
              steps: {
                orderBy: { stepOrder: 'asc' },
                select: { id: true, name: true, stepOrder: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              step: {
                select: { name: true },
              },
            },
          },
        },
      })

      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      const currentStepIndex = conversation.currentStepId
        ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
        : 0

      return {
        id: conversation.id,
        title: conversation.title,
        workflowId: conversation.workflowId,
        workflow: {
          id: conversation.workflow.id,
          name: conversation.workflow.name,
          type: conversation.workflow.type,
          projectPath: conversation.workflow.projectPath,
          steps: conversation.workflow.steps,
        },
        currentStepId: conversation.currentStepId,
        currentStepIndex: Math.max(0, currentStepIndex),
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          stepId: m.stepId,
          stepName: m.step?.name || null,
          selectedForContext: m.selectedForContext,
          metadata: m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : null,
          createdAt: m.createdAt.toISOString(),
        })),
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      }
    }
  )
}
