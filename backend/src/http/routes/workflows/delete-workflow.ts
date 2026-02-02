import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function deleteWorkflow(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Delete workflow',
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existing = await prisma.workflow.findUnique({ where: { id } })
      if (!existing) {
        throw new NotFoundError('Workflow not found')
      }

      await prisma.workflow.delete({ where: { id } })

      return reply.status(204).send(null)
    }
  )
}
