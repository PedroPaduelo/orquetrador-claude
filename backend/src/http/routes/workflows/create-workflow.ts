import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

const stepSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  systemPrompt: z.string().optional(),
  systemPromptNoteId: z.string().optional(),
  contextNoteIds: z.array(z.string()).default([]),
  memoryNoteIds: z.array(z.string()).default([]),
  conditions: z.object({
    rules: z.array(z.object({
      type: z.enum(['contains', 'not_contains', 'equals', 'starts_with', 'ends_with', 'regex', 'length_gt', 'length_lt']),
      match: z.string(),
      goto: z.string(),
      maxRetries: z.number().optional(),
      retryMessage: z.string().optional(),
    })).default([]),
    default: z.string().default('next'),
  }).default({ rules: [], default: 'next' }),
  maxRetries: z.number().default(0),
})

export async function createWorkflow(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/workflows',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Create a new workflow',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(['sequential', 'step_by_step']),
          projectPath: z.string().optional(),
          steps: z.array(stepSchema).min(1),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            projectPath: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, description, type, projectPath, steps } = request.body

      const workflow = await prisma.workflow.create({
        data: {
          name,
          description,
          type,
          projectPath,
          steps: {
            create: steps.map((step, index) => ({
              name: step.name,
              baseUrl: step.baseUrl,
              stepOrder: index + 1,
              systemPrompt: step.systemPrompt,
              systemPromptNoteId: step.systemPromptNoteId,
              contextNoteIds: step.contextNoteIds,
              memoryNoteIds: step.memoryNoteIds,
              conditions: step.conditions,
              maxRetries: step.maxRetries,
            })),
          },
        },
      })

      return reply.status(201).send({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        projectPath: workflow.projectPath,
        createdAt: workflow.createdAt.toISOString(),
      })
    }
  )
}
