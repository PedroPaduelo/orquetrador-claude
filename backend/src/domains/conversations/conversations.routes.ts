import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { conversationsRepository } from './conversations.repository.js'
import { conversationsService } from './conversations.service.js'
import { prisma } from '../../lib/prisma.js'
import { NotFoundError } from '../../http/errors/index.js'

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || '/workspace/temp-orquestrador'

function getUserProjectsDir(userId: string): string {
  return join(PROJECT_BASE_PATH, 'users', userId, 'projetos')
}

export async function conversationsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /folders — list project folders for the logged-in user
  server.get(
    '/folders',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'List available project folders',
        response: {
          200: z.array(z.object({
            name: z.string(),
            path: z.string(),
            conversationsCount: z.number(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const userProjectsDir = getUserProjectsDir(userId)
      mkdirSync(userProjectsDir, { recursive: true })

      const entries = readdirSync(userProjectsDir)
      const dirs = entries.filter((entry) => {
        try {
          return statSync(join(userProjectsDir, entry)).isDirectory()
        } catch {
          return false
        }
      })

      const counts = await prisma.conversation.groupBy({
        by: ['projectPath'],
        _count: { id: true },
        where: { projectPath: { not: null }, userId },
      })

      const countMap = new Map<string, number>()
      for (const c of counts) {
        if (c.projectPath) countMap.set(c.projectPath, c._count.id)
      }

      return dirs.map((name) => {
        const fullPath = join(userProjectsDir, name)
        return {
          name,
          path: fullPath,
          conversationsCount: countMap.get(fullPath) || 0,
        }
      })
    }
  )

  // POST /conversations
  server.post(
    '/conversations',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Create a new conversation',
        body: z.object({
          workflowId: z.string(),
          title: z.string().optional(),
          projectPath: z.string(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            workflowId: z.string(),
            title: z.string().nullable(),
            projectPath: z.string().nullable(),
            currentStepId: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const conversation = await conversationsRepository.create(request.body, userId)
      if (!conversation) throw new NotFoundError('Workflow not found')
      return reply.status(201).send(conversation)
    }
  )

  // GET /conversations
  server.get(
    '/conversations',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'List all conversations',
        querystring: z.object({
          workflowId: z.string().optional(),
        }),
        response: {
          200: z.array(z.object({
            id: z.string(),
            title: z.string().nullable(),
            projectPath: z.string().nullable(),
            workflowId: z.string(),
            workflowName: z.string(),
            workflowType: z.string(),
            currentStepId: z.string().nullable(),
            currentStepName: z.string().nullable(),
            messagesCount: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      return conversationsRepository.findAll(userId, request.query.workflowId)
    }
  )

  // GET /conversations/:id
  server.get(
    '/conversations/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get conversation with messages',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            title: z.string().nullable(),
            projectPath: z.string().nullable(),
            workflowId: z.string(),
            workflow: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              steps: z.array(z.object({
                id: z.string(),
                name: z.string(),
                stepOrder: z.number(),
              })),
            }),
            currentStepId: z.string().nullable(),
            currentStepIndex: z.number(),
            messages: z.array(z.object({
              id: z.string(),
              role: z.string(),
              content: z.string(),
              stepId: z.string().nullable(),
              stepName: z.string().nullable(),
              selectedForContext: z.boolean(),
              metadata: z.unknown().nullable(),
              attachments: z.array(z.object({
                id: z.string(),
                filename: z.string(),
                mimeType: z.string(),
                size: z.number(),
                url: z.string(),
              })).optional(),
              createdAt: z.string(),
            })),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const conversation = await conversationsRepository.findById(request.params.id)
      if (!conversation) throw new NotFoundError('Conversation not found')
      return conversation
    }
  )

  // PATCH /conversations/:id
  server.patch(
    '/conversations/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Update conversation title',
        params: z.object({ id: z.string() }),
        body: z.object({ title: z.string().min(1).max(200) }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      await conversationsRepository.updateTitle(request.params.id, request.body.title)
      return reply.status(204).send(null)
    }
  )

  // POST /conversations/:id/clone
  server.post(
    '/conversations/:id/clone',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Clone a conversation (same workflow and project folder)',
        params: z.object({ id: z.string() }),
        body: z.any().optional(),
        response: {
          201: z.object({
            id: z.string(),
            workflowId: z.string(),
            title: z.string().nullable(),
            projectPath: z.string().nullable(),
            currentStepId: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const cloned = await conversationsRepository.clone(request.params.id, userId)
      if (!cloned) throw new NotFoundError('Conversation not found')
      return reply.status(201).send(cloned)
    }
  )

  // DELETE /conversations/:id
  server.delete(
    '/conversations/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Delete a conversation',
        params: z.object({ id: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      await conversationsRepository.delete(request.params.id)
      return reply.status(204).send(null)
    }
  )

  // POST /conversations/:id/advance-step
  server.post(
    '/conversations/:id/advance-step',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Advance to the next step in a step_by_step conversation',
        params: z.object({ id: z.string() }),
        body: z.any().optional(),
        response: {
          200: z.object({
            id: z.string(),
            currentStepId: z.string(),
            currentStepIndex: z.number(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      return conversationsService.advanceStep(request.params.id)
    }
  )

  // POST /conversations/:id/go-back-step
  server.post(
    '/conversations/:id/go-back-step',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Go back to the previous step in a step_by_step conversation',
        params: z.object({ id: z.string() }),
        body: z.any().optional(),
        response: {
          200: z.object({
            id: z.string(),
            currentStepId: z.string(),
            currentStepIndex: z.number(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      return conversationsService.goBack(request.params.id)
    }
  )

  // POST /conversations/:id/jump-to-step
  server.post(
    '/conversations/:id/jump-to-step',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Jump directly to any step in a step_by_step conversation',
        params: z.object({ id: z.string() }),
        body: z.object({
          stepId: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            currentStepId: z.string(),
            currentStepIndex: z.number(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      return conversationsService.jumpToStep(request.params.id, request.body.stepId)
    }
  )

  // DELETE /conversations/:id/sessions/:stepId
  server.delete(
    '/conversations/:id/sessions/:stepId',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Reset session for a specific step',
        params: z.object({
          id: z.string(),
          stepId: z.string(),
        }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      await conversationsService.resetStepSession(request.params.id, request.params.stepId)
      return reply.status(204).send(null)
    }
  )

  // POST /conversations/:id/cancel
  server.post(
    '/conversations/:id/cancel',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Cancel an active execution for a conversation',
        params: z.object({ id: z.string() }),
        body: z.any().optional(),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      return conversationsService.cancel(request.params.id)
    }
  )

  // GET /conversations/:id/status
  server.get(
    '/conversations/:id/status',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get execution status for a conversation',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            conversationId: z.string(),
            isExecuting: z.boolean(),
            lastExecution: z.object({
              id: z.string(),
              state: z.string(),
              currentStepIndex: z.number(),
              createdAt: z.string(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      return conversationsService.getStatus(request.params.id)
    }
  )

  // GET /conversations/:id/token-usage
  server.get(
    '/conversations/:id/token-usage',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get token usage per step for a conversation',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            conversationId: z.string(),
            steps: z.array(z.object({
              stepId: z.string(),
              stepName: z.string(),
              inputTokens: z.number(),
              outputTokens: z.number(),
              totalTokens: z.number(),
            })),
            totalInputTokens: z.number(),
            totalOutputTokens: z.number(),
            grandTotalTokens: z.number(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      return conversationsService.getTokenUsage(request.params.id)
    }
  )

  // GET /conversations/:id/execution-stats
  server.get(
    '/conversations/:id/execution-stats',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get detailed execution statistics for a conversation',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            conversationId: z.string(),
            // Token usage
            tokens: z.object({
              input: z.number(),
              output: z.number(),
              cacheCreation: z.number(),
              cacheRead: z.number(),
              total: z.number(),
            }),
            // Cost and performance
            cost: z.object({
              estimatedUsd: z.number().nullable(),
              totalCostUsd: z.number().nullable(),
            }),
            performance: z.object({
              totalDurationMs: z.number().nullable(),
              apiDurationMs: z.number().nullable(),
              numTurns: z.number(),
            }),
            // Tools usage
            tools: z.object({
              webSearchRequests: z.number(),
              webFetchRequests: z.number(),
            }),
            // Steps breakdown
            steps: z.array(z.object({
              stepId: z.string(),
              stepName: z.string(),
              inputTokens: z.number(),
              outputTokens: z.number(),
              totalTokens: z.number(),
              durationMs: z.number().nullable(),
              actionsCount: z.number(),
              exitCode: z.number().nullable(),
              resultStatus: z.string(),
            })),
            // Session info
            session: z.object({
              claudeCodeVersion: z.string().nullable(),
              sessionId: z.string().nullable(),
              model: z.string().nullable(),
              stopReason: z.string().nullable(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      return conversationsService.getExecutionStats(request.params.id)
    }
  )
}
