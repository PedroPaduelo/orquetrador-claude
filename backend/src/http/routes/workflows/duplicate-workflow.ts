import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function duplicateWorkflow(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/workflows/:id/duplicate',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Duplicate a workflow with all its steps',
        params: z.object({
          id: z.string(),
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
      const { id } = request.params

      // Fetch original workflow with all steps and relations
      const original = await prisma.workflow.findUnique({
        where: { id },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              mcpServers: { select: { serverId: true } },
              skills: { select: { skillId: true } },
              agents: { select: { agentId: true } },
              rules: { select: { ruleId: true } },
            },
          },
        },
      })

      if (!original) {
        throw new NotFoundError('Workflow not found')
      }

      // Create duplicate with all steps
      const duplicate = await prisma.workflow.create({
        data: {
          name: `${original.name} (Cópia)`,
          description: original.description,
          type: original.type,
          projectPath: original.projectPath,
          steps: {
            create: original.steps.map((step) => ({
              name: step.name,
              baseUrl: step.baseUrl,
              stepOrder: step.stepOrder,
              systemPrompt: step.systemPrompt,
              systemPromptNoteId: step.systemPromptNoteId,
              contextNoteIds: step.contextNoteIds,
              memoryNoteIds: step.memoryNoteIds,
              conditions: step.conditions,
              maxRetries: step.maxRetries,
              backend: step.backend,
              model: step.model,
              mcpServers: {
                create: step.mcpServers.map((m) => ({ serverId: m.serverId })),
              },
              skills: {
                create: step.skills.map((s) => ({ skillId: s.skillId })),
              },
              agents: {
                create: step.agents.map((a) => ({ agentId: a.agentId })),
              },
              rules: {
                create: step.rules.map((r) => ({ ruleId: r.ruleId })),
              },
            })),
          },
        },
      })

      return reply.status(201).send({
        id: duplicate.id,
        name: duplicate.name,
        description: duplicate.description,
        type: duplicate.type,
        projectPath: duplicate.projectPath,
        createdAt: duplicate.createdAt.toISOString(),
      })
    }
  )
}
