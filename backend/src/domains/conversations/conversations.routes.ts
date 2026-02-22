import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { conversationsRepository } from './conversations.repository.js'
import { conversationsService } from './conversations.service.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function conversationsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

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
        }),
        response: {
          201: z.object({
            id: z.string(),
            workflowId: z.string(),
            title: z.string().nullable(),
            currentStepId: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const conversation = await conversationsRepository.create(request.body)
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
      return conversationsRepository.findAll(request.query.workflowId)
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
            workflowId: z.string(),
            workflow: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              projectPath: z.string().nullable(),
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
      const conversation = await conversationsRepository.findById(request.params.id)
      if (!conversation) throw new NotFoundError('Conversation not found')
      return conversation
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
      return conversationsService.goBack(request.params.id)
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
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
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
      const existing = await conversationsRepository.findByIdSimple(request.params.id)
      if (!existing) throw new NotFoundError('Conversation not found')

      return conversationsService.getStatus(request.params.id)
    }
  )
}
