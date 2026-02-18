import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError, BadRequestError } from '../_errors/index.js'

export async function goBackStep(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/conversations/:id/go-back-step',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Go back to previous step in workflow',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            currentStepId: z.string().nullable(),
            currentStepIndex: z.number(),
            message: z.string(),
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
        },
      })

      if (!conversation) {
        throw new NotFoundError('Conversation not found')
      }

      if (conversation.workflow.type !== 'step_by_step') {
        throw new BadRequestError('Only step_by_step workflows can change steps manually')
      }

      const steps = conversation.workflow.steps
      if (steps.length === 0) {
        throw new BadRequestError('Workflow has no steps')
      }

      // Find current step index
      const currentStepIndex = conversation.currentStepId
        ? steps.findIndex((s) => s.id === conversation.currentStepId)
        : 0

      // Check if already at first step
      if (currentStepIndex <= 0) {
        throw new BadRequestError('Already at the first step')
      }

      // Go back to previous step
      const prevStepIndex = currentStepIndex - 1
      const prevStep = steps[prevStepIndex]

      await prisma.conversation.update({
        where: { id },
        data: {
          currentStepId: prevStep.id,
        },
      })

      return {
        id: conversation.id,
        currentStepId: prevStep.id,
        currentStepIndex: prevStepIndex,
        message: `Went back to step: ${prevStep.name}`,
      }
    }
  )
}
