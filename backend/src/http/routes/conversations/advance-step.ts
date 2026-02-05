import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError, BadRequestError } from '../_errors/index.js'

export async function advanceStep(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/conversations/:id/advance-step',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Advance to next step in workflow',
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
        throw new BadRequestError('Only step_by_step workflows can advance steps manually')
      }

      const steps = conversation.workflow.steps
      if (steps.length === 0) {
        throw new BadRequestError('Workflow has no steps')
      }

      // Find current step index
      const currentStepIndex = conversation.currentStepId
        ? steps.findIndex((s) => s.id === conversation.currentStepId)
        : 0

      // Check if already at last step
      if (currentStepIndex >= steps.length - 1) {
        throw new BadRequestError('Already at the last step')
      }

      // Advance to next step
      const nextStepIndex = currentStepIndex + 1
      const nextStep = steps[nextStepIndex]

      await prisma.conversation.update({
        where: { id },
        data: {
          currentStepId: nextStep.id,
        },
      })

      return {
        id: conversation.id,
        currentStepId: nextStep.id,
        currentStepIndex: nextStepIndex,
        message: `Advanced to step: ${nextStep.name}`,
      }
    }
  )
}
