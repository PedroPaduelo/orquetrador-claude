import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function createConversation(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/conversations',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Create a new conversation',
        body: z.object({
          workflowId: z.string(),
          title: z.string().optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            workflowId: z.string(),
            title: z.string().nullable(),
            currentStepId: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { workflowId, title } = request.body

      // Verify workflow exists and get first step
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            take: 1,
          },
        },
      })

      if (!workflow) {
        throw new NotFoundError('Workflow not found')
      }

      const firstStep = workflow.steps[0]

      const conversation = await prisma.conversation.create({
        data: {
          workflowId,
          title: title || `${workflow.name} - ${new Date().toLocaleDateString('pt-BR')}`,
          currentStepId: firstStep?.id,
        },
      })

      return reply.status(201).send({
        id: conversation.id,
        workflowId: conversation.workflowId,
        title: conversation.title,
        currentStepId: conversation.currentStepId,
        createdAt: conversation.createdAt.toISOString(),
      })
    }
  )
}
