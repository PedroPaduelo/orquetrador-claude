import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function feedbackRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /messages/:messageId/feedback — thumbs up/down on a message
  server.post('/messages/:messageId/feedback', {
    schema: {
      tags: ['Feedback'],
      summary: 'Add feedback to a message (thumbs up/down)',
      params: z.object({ messageId: z.string().uuid() }),
      body: z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().max(500).optional(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          rating: z.number(),
          comment: z.string().nullable(),
          messageId: z.string(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const { messageId } = request.params
    const { rating, comment } = request.body

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, conversation: { select: { userId: true } } },
    })
    if (!message || message.conversation.userId !== userId) {
      throw new NotFoundError('Message not found')
    }

    // Upsert: one feedback per message
    const existing = await prisma.messageFeedback.findFirst({
      where: { messageId },
    })

    const feedback = existing
      ? await prisma.messageFeedback.update({
          where: { id: existing.id },
          data: { rating, comment: comment ?? null },
        })
      : await prisma.messageFeedback.create({
          data: {
            messageId,
            conversationId: message.conversationId,
            rating,
            comment: comment ?? null,
          },
        })

    return {
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      messageId: feedback.messageId,
      createdAt: feedback.createdAt.toISOString(),
    }
  })

  // GET /messages/:messageId/feedback — get feedback for a message
  server.get('/messages/:messageId/feedback', {
    schema: {
      tags: ['Feedback'],
      params: z.object({ messageId: z.string().uuid() }),
    },
  }, async (request) => {
    const { messageId } = request.params
    const feedback = await prisma.messageFeedback.findFirst({
      where: { messageId },
    })
    if (!feedback) return null
    return {
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      messageId: feedback.messageId,
      createdAt: feedback.createdAt.toISOString(),
    }
  })

  // POST /executions/:executionId/rating — rate an execution
  server.post('/executions/:executionId/rating', {
    schema: {
      tags: ['Feedback'],
      summary: 'Rate an execution',
      params: z.object({ executionId: z.string().uuid() }),
      body: z.object({
        rating: z.number().min(1).max(5),
        feedback: z.string().max(500).optional(),
        stepId: z.string().uuid().optional(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          rating: z.number(),
          feedback: z.string().nullable(),
          executionId: z.string(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request) => {
    const userId = await request.getCurrentUserId()
    const { executionId } = request.params
    const { rating, feedback, stepId } = request.body

    const result = await prisma.executionRating.upsert({
      where: {
        executionId_stepId_userId: {
          executionId,
          stepId: stepId ?? '',
          userId,
        },
      },
      create: {
        executionId,
        stepId: stepId ?? null,
        userId,
        rating,
        feedback: feedback ?? null,
      },
      update: {
        rating,
        feedback: feedback ?? null,
      },
    })

    return {
      id: result.id,
      rating: result.rating,
      feedback: result.feedback,
      executionId: result.executionId,
      createdAt: result.createdAt.toISOString(),
    }
  })
}
