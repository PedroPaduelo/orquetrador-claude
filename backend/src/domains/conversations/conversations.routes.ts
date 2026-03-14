import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { conversationsRepository } from './conversations.repository.js'
import { conversationsService } from './conversations.service.js'
import { prisma } from '../../lib/prisma.js'
import { NotFoundError } from '../../http/errors/index.js'
import Anthropic from '@anthropic-ai/sdk'

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
      mkdirSync(userProjectsDir, { recursive: true, mode: 0o775 })

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

  // DELETE /conversations/batch - delete multiple conversations
  server.delete(
    '/conversations/batch',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Delete multiple conversations',
        body: z.object({ ids: z.array(z.string()).min(1).max(100) }),
        response: {
          200: z.object({ deleted: z.number() }),
        },
      },
    },
    async (request, reply) => {
      await request.getCurrentUserId()
      const { ids } = request.body
      const result = await prisma.conversation.deleteMany({
        where: { id: { in: ids } },
      })
      return reply.send({ deleted: result.count })
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
            isPaused: z.boolean(),
            pausedInfo: z.object({
              executionId: z.string(),
              stepId: z.string(),
              stepIndex: z.number(),
              resumeToken: z.string().nullable(),
              pausedAt: z.string(),
              askUserQuestion: z.object({
                question: z.string(),
                options: z.array(z.object({
                  label: z.string(),
                  description: z.string().optional(),
                })).optional(),
              }).optional().nullable(),
            }).nullable(),
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

  // GET /conversations/:id/suggestions — AI-powered next step suggestions
  server.get(
    '/conversations/:id/suggestions',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Get AI-suggested next steps based on conversation history',
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            suggestions: z.array(z.object({
              text: z.string(),
              description: z.string(),
            })),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { id } = request.params

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          workflow: {
            include: { steps: { orderBy: { stepOrder: 'asc' }, select: { id: true, name: true, systemPrompt: true, stepOrder: true } } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { role: true, content: true, stepId: true, metadata: true, createdAt: true },
          },
        },
      })

      if (!conversation) throw new NotFoundError('Conversation not found')

      const recentMessages = conversation.messages.reverse()

      // Build rich step context
      const stepsContext = conversation.workflow?.steps.map((s, i) => {
        const prompt = s.systemPrompt ? s.systemPrompt.slice(0, 300) : 'sem prompt'
        return `Step ${i + 1}: "${s.name}" — ${prompt}`
      }).join('\n') || 'Nenhum step definido'

      // Get last assistant messages with more content
      const assistantMessages = recentMessages.filter(m => m.role === 'assistant')
      const lastAssistant = assistantMessages[assistantMessages.length - 1]
      const lastContent = lastAssistant?.content?.slice(0, 4000) || ''

      // Extract actions/tools used from metadata
      const lastMetadata = lastAssistant?.metadata as Record<string, unknown> | null
      const lastActions = (lastMetadata?.actions as Array<{ type: string; name?: string }> || [])
        .filter(a => a.type === 'tool_use')
        .map(a => a.name)
        .filter(Boolean)

      // Build conversation summary
      const conversationSummary = recentMessages.map(m => {
        const role = m.role === 'user' ? 'USUARIO' : 'CLAUDE'
        const content = m.content.slice(0, 500)
        return `[${role}]: ${content}`
      }).join('\n\n')

      // Detect what was done (files created, commands run, etc.)
      const userMessages = recentMessages.filter(m => m.role === 'user')
      const firstUserMsg = userMessages[0]?.content?.slice(0, 500) || ''
      const lastUserMsg = userMessages[userMessages.length - 1]?.content?.slice(0, 500) || ''

      try {
        const client = new Anthropic({
          baseURL: 'https://loadbalance-back.ddw1sl.easypanel.host/teste',
          apiKey: process.env.ANTHROPIC_API_KEY || 'sk-placeholder',
        })
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5000,
          system: `Voce é um arquiteto de software senior que guia desenvolvedores nos proximos passos de construção de aplicações. Voce analisa o que ja foi feito e sugere o proximo passo LOGICO e ESPECIFICO que o usuario deve pedir ao Claude Code.

REGRAS:
- Suas sugestoes devem ser COMANDOS DIRETOS que o usuario cola no chat e envia ao Claude
- Cada sugestao deve ser especifica ao projeto, nao generica
- Analise o que ja foi feito e sugira o PROXIMO passo natural da construção
- Se o Claude criou arquivos, sugira o proximo arquivo/feature que faz sentido
- Se houve erro, sugira como corrigir
- Pense como um tech lead guiando um junior: qual o proximo passo que faz o app avançar?
- Sugestoes devem ser em portugues
- O "text" é o que o usuario vai enviar como mensagem ao Claude, entao deve ser uma instrucao clara e completa`,
          messages: [{
            role: 'user',
            content: `CONTEXTO DO PROJETO:

Workflow configurado:
${stepsContext}

Primeira mensagem do usuario (objetivo original):
${firstUserMsg}

Ultima mensagem do usuario:
${lastUserMsg}

Tools/ações que o Claude usou na ultima execução:
${lastActions.length > 0 ? lastActions.join(', ') : 'nenhuma detectada'}

Ultima resposta completa do Claude:
${lastContent}

Historico completo recente (${recentMessages.length} mensagens):
${conversationSummary}

---

Com base em TUDO acima, sugira exatamente 4 proximos passos. Cada sugestao deve ser uma instrucao COMPLETA e ESPECIFICA que o usuario pode enviar diretamente ao Claude Code.

Responda SOMENTE com JSON valido, sem markdown, sem explicação extra:
[{"text":"instrucao completa e especifica para o Claude","description":"por que esse passo é importante agora (1 frase)"}]`,
          }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
        const jsonMatch = text.match(/\[[\s\S]*?\]/)
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []

        return { suggestions: suggestions.slice(0, 4) }
      } catch (err) {
        console.error('[Suggestions] Anthropic API error:', err)
        return { suggestions: [] }
      }
    }
  )
}
