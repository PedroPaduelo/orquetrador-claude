import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function listWorkflows(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/workflows',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'List all workflows',
        response: {
          200: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            projectPath: z.string().nullable(),
            stepsCount: z.number(),
            conversationsCount: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
          })),
        },
      },
    },
    async () => {
      const workflows = await prisma.workflow.findMany({
        include: {
          _count: {
            select: {
              steps: true,
              conversations: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      return workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        type: w.type,
        projectPath: w.projectPath,
        stepsCount: w._count.steps,
        conversationsCount: w._count.conversations,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      }))
    }
  )
}
