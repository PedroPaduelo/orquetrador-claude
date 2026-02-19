import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

const conditionsSchema = z.object({
  rules: z.array(z.object({
    type: z.enum(['contains', 'not_contains', 'equals', 'starts_with', 'ends_with', 'regex', 'length_gt', 'length_lt']),
    match: z.string(),
    goto: z.string(),
    maxRetries: z.number().optional(),
    retryMessage: z.string().optional(),
  })).default([]),
  default: z.string().default('next'),
})

const stepSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  baseUrl: z.string().default(''),
  systemPrompt: z.string().nullable().optional(),
  systemPromptNoteId: z.string().nullable().optional(),
  contextNoteIds: z.array(z.string()).default([]),
  memoryNoteIds: z.array(z.string()).default([]),
  conditions: conditionsSchema.nullable().default({ rules: [], default: 'next' }).transform((v) => v ?? { rules: [], default: 'next' }),
  maxRetries: z.number().default(0),
  backend: z.enum(['claude', 'api']).default('claude'),
  model: z.string().nullable().optional(),
  mcpServerIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  agentIds: z.array(z.string()).default([]),
  ruleIds: z.array(z.string()).default([]),
})

export async function updateWorkflow(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Update workflow',
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          type: z.enum(['sequential', 'step_by_step']).optional(),
          projectPath: z.string().optional(),
          steps: z.array(stepSchema).optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            projectPath: z.string().nullable(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { name, description, type, projectPath, steps } = request.body

      const existing = await prisma.workflow.findUnique({ where: { id } })
      if (!existing) {
        throw new NotFoundError('Workflow not found')
      }

      // If steps are provided, delete existing and recreate
      if (steps) {
        // Delete join table entries first, then steps
        const existingSteps = await prisma.workflowStep.findMany({ where: { workflowId: id }, select: { id: true } })
        const stepIds = existingSteps.map((s) => s.id)
        await prisma.workflowStepMcpServer.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepSkill.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepAgent.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStepRule.deleteMany({ where: { stepId: { in: stepIds } } })
        await prisma.workflowStep.deleteMany({ where: { workflowId: id } })
      }

      const workflow = await prisma.workflow.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(projectPath !== undefined && { projectPath }),
          ...(steps && {
            steps: {
              create: steps.map((step, index) => ({
                name: step.name,
                baseUrl: step.baseUrl,
                stepOrder: index + 1,
                systemPrompt: step.systemPrompt,
                systemPromptNoteId: step.systemPromptNoteId,
                contextNoteIds: JSON.stringify(step.contextNoteIds),
                memoryNoteIds: JSON.stringify(step.memoryNoteIds),
                conditions: JSON.stringify(step.conditions),
                maxRetries: step.maxRetries,
                backend: step.backend,
                model: step.model,
                mcpServers: {
                  create: step.mcpServerIds.map((serverId) => ({ serverId })),
                },
                skills: {
                  create: step.skillIds.map((skillId) => ({ skillId })),
                },
                agents: {
                  create: step.agentIds.map((agentId) => ({ agentId })),
                },
                rules: {
                  create: step.ruleIds.map((ruleId) => ({ ruleId })),
                },
              })),
            },
          }),
        },
      })

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        projectPath: workflow.projectPath,
        updatedAt: workflow.updatedAt.toISOString(),
      }
    }
  )
}
