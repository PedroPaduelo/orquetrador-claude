import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { safeJsonParse } from '../../../lib/safe-json.js'
import { NotFoundError } from '../_errors/index.js'

export async function getWorkflow(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/workflows/:id',
    {
      schema: {
        tags: ['Workflows'],
        summary: 'Get workflow by ID',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            type: z.string(),
            projectPath: z.string().nullable(),
            steps: z.array(z.object({
              id: z.string(),
              name: z.string(),
              baseUrl: z.string(),
              stepOrder: z.number(),
              systemPrompt: z.string().nullable(),
              systemPromptNoteId: z.string().nullable(),
              contextNoteIds: z.array(z.string()),
              memoryNoteIds: z.array(z.string()),
              conditions: z.unknown(),
              maxRetries: z.number(),
              backend: z.string(),
              model: z.string().nullable(),
              mcpServerIds: z.array(z.string()),
              skillIds: z.array(z.string()),
              agentIds: z.array(z.string()),
              ruleIds: z.array(z.string()),
            })),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const workflow = await prisma.workflow.findUnique({
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

      if (!workflow) {
        throw new NotFoundError('Workflow not found')
      }

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        projectPath: workflow.projectPath,
        steps: workflow.steps.map((s) => ({
          id: s.id,
          name: s.name,
          baseUrl: s.baseUrl,
          stepOrder: s.stepOrder,
          systemPrompt: s.systemPrompt,
          systemPromptNoteId: s.systemPromptNoteId,
          contextNoteIds: safeJsonParse<string[]>(s.contextNoteIds, []),
          memoryNoteIds: safeJsonParse<string[]>(s.memoryNoteIds, []),
          conditions: safeJsonParse(s.conditions, null),
          maxRetries: s.maxRetries,
          backend: s.backend,
          model: s.model,
          mcpServerIds: s.mcpServers.map((m) => m.serverId),
          skillIds: s.skills.map((sk) => sk.skillId),
          agentIds: s.agents.map((a) => a.agentId),
          ruleIds: s.rules.map((r) => r.ruleId),
        })),
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      }
    }
  )
}
