import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function executionRatingsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.post('/executions/:executionId/ratings', {
    schema: {
      tags: ['Observability'],
      summary: 'Criar rating para uma execucao',
      params: z.object({ executionId: z.string().uuid() }),
      body: z.object({
        rating: z.number().int().min(1).max(5),
        feedback: z.string().optional(),
        stepId: z.string().uuid().optional(),
      }),
      response: {
        201: z.object({
          id: z.string(),
          executionId: z.string(),
          rating: z.number(),
          feedback: z.string().nullable(),
          stepId: z.string().nullable(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const { executionId } = request.params
    const { rating, feedback, stepId } = request.body

    const record = await prisma.executionRating.upsert({
      where: {
        executionId_stepId_userId: {
          executionId,
          stepId: stepId ?? '',
          userId,
        },
      },
      update: { rating, feedback },
      create: {
        executionId,
        stepId: stepId ?? null,
        rating,
        feedback: feedback ?? null,
        userId,
      },
    })

    return reply.status(201).send({
      id: record.id,
      executionId: record.executionId,
      rating: record.rating,
      feedback: record.feedback,
      stepId: record.stepId,
      createdAt: record.createdAt.toISOString(),
    })
  })

  server.get('/executions/:executionId/ratings', {
    schema: {
      tags: ['Observability'],
      summary: 'Listar ratings de uma execucao',
      params: z.object({ executionId: z.string().uuid() }),
      response: {
        200: z.array(z.object({
          id: z.string(),
          executionId: z.string(),
          rating: z.number(),
          feedback: z.string().nullable(),
          stepId: z.string().nullable(),
          userId: z.string(),
          createdAt: z.string(),
        })),
      },
    },
  }, async (request) => {
    const { executionId } = request.params

    const ratings = await prisma.executionRating.findMany({
      where: { executionId },
      orderBy: { createdAt: 'desc' },
    })

    return ratings.map(r => ({
      id: r.id,
      executionId: r.executionId,
      rating: r.rating,
      feedback: r.feedback,
      stepId: r.stepId,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }))
  })
}
