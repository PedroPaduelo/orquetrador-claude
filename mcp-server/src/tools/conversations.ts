import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiDelete, apiPostSSE, formatResult, type SSEResult } from '../api-client.js'

// Background executions store for async pattern
const backgroundExecutions = new Map<string, {
  promise: Promise<{ ok: boolean; status: number; data: SSEResult }>
  startedAt: Date
}>()

export function registerConversationTools(server: McpServer) {
  server.tool(
    'conversation_list',
    `Lista todas as conversas do sistema.

PARAMETROS OPCIONAIS:
- workflowId: Filtrar por workflow especifico

RETORNA: Array de conversas com id, title, workflowId, workflowName, workflowType, currentStepName, messagesCount, projectPath, createdAt.`,
    {
      workflowId: z.string().optional().describe('Filtrar por workflow ID'),
    },
    async ({ workflowId }) => {
      const query = workflowId ? `?workflowId=${workflowId}` : ''
      return formatResult(await apiGet(`/conversations${query}`))
    }
  )

  server.tool(
    'conversation_get',
    `Busca uma conversa especifica pelo ID com detalhes completos.

RETORNA: Conversa com workflow (incluindo steps), messages (com attachments), currentStepIndex.

USE para investigar o historico de uma conversa especifica.`,
    { id: z.string().describe('ID da conversa') },
    async ({ id }) => formatResult(await apiGet(`/conversations/${id}`))
  )

  server.tool(
    'conversation_create',
    `Cria uma nova conversa associada a um workflow.

INPUT:
- workflowId: ID do workflow (obrigatorio)
- title: Titulo da conversa (opcional, auto-gerado)
- projectPath: Path do projeto onde a IA vai trabalhar (obrigatorio)

EXEMPLO:
{ "workflowId": "abc123", "projectPath": "/workspace/meu-projeto", "title": "Revisao do modulo auth" }`,
    {
      workflowId: z.string().describe('ID do workflow'),
      title: z.string().optional().describe('Titulo da conversa'),
      projectPath: z.string().describe('Path do projeto'),
    },
    async (args) => formatResult(await apiPost('/conversations', args))
  )

  server.tool(
    'conversation_delete',
    `Deleta uma conversa permanentemente.`,
    { id: z.string().describe('ID da conversa a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/conversations/${id}`))
  )

  server.tool(
    'conversation_advance_step',
    `Avanca para o proximo step em uma conversa step_by_step.

RETORNA: { id, currentStepId, currentStepIndex, message }

SO FUNCIONA em conversas com workflow tipo "step_by_step".`,
    { id: z.string().describe('ID da conversa') },
    async ({ id }) => formatResult(await apiPost(`/conversations/${id}/advance-step`))
  )

  server.tool(
    'conversation_go_back_step',
    `Volta para o step anterior em uma conversa step_by_step.`,
    { id: z.string().describe('ID da conversa') },
    async ({ id }) => formatResult(await apiPost(`/conversations/${id}/go-back-step`))
  )

  server.tool(
    'conversation_jump_to_step',
    `Pula diretamente para um step especifico em uma conversa step_by_step.`,
    {
      id: z.string().describe('ID da conversa'),
      stepId: z.string().describe('ID do step destino'),
    },
    async ({ id, stepId }) => formatResult(await apiPost(`/conversations/${id}/jump-to-step`, { stepId }))
  )

  server.tool(
    'conversation_cancel',
    `Cancela uma execucao ativa de uma conversa.

RETORNA: { success, message }`,
    { id: z.string().describe('ID da conversa') },
    async ({ id }) => formatResult(await apiPost(`/conversations/${id}/cancel`))
  )

  server.tool(
    'conversation_status',
    `Verifica o status de execucao de uma conversa.

RETORNA: { conversationId, isExecuting, lastExecution: { id, state, currentStepIndex, createdAt } }

USE para verificar se uma conversa esta em execucao ou ver detalhes da ultima execucao.`,
    { id: z.string().describe('ID da conversa') },
    async ({ id }) => formatResult(await apiGet(`/conversations/${id}/status`))
  )

  server.tool(
    'conversation_messages',
    `Lista mensagens de uma conversa com filtro opcional por step.

PARAMETROS:
- id: ID da conversa (obrigatorio)
- stepId: Filtrar por step especifico (opcional)

RETORNA: Array de mensagens com id, role (user/assistant), content, stepId, stepName, selectedForContext, attachments, createdAt.

USE para ler o historico de mensagens de uma conversa.`,
    {
      id: z.string().describe('ID da conversa'),
      stepId: z.string().optional().describe('Filtrar por step ID'),
    },
    async ({ id, stepId }) => {
      const query = stepId ? `?stepId=${stepId}` : ''
      return formatResult(await apiGet(`/conversations/${id}/messages${query}`))
    }
  )

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE (synchronous — waits for full execution)
  // ─────────────────────────────────────────────────────────
  server.tool(
    'conversation_send_message',
    `Envia uma mensagem para uma conversa e AGUARDA o resultado completo da execucao do workflow.

ESTA E A TOOL PRINCIPAL PARA ORQUESTRACAO E SWARM DE AGENTES.

INPUT:
- id: ID da conversa (obrigatorio)
- content: Mensagem a enviar (obrigatorio)
- stepIndex: Indice do step a executar (opcional, para step_by_step)
- timeoutMs: Timeout em ms (opcional, padrao 600000 = 10min)

RETORNA:
- executionId: ID da execucao
- content: Resposta completa do assistente (ultimo step)
- stepsCompleted: Array com nome e ordem de cada step completado
- error: Mensagem de erro (se houver)

FLUXO:
1. Conecta no endpoint SSE de streaming
2. Aguarda todos os steps do workflow executarem
3. Retorna o resultado final agregado

EXEMPLO DE ORQUESTRACAO (swarm):
1. conversation_create → cria conversa com workflow "Frontend"
2. conversation_send_message → envia demanda, recebe resultado
3. conversation_create → cria conversa com workflow "Backend"
4. conversation_send_message → envia demanda + contexto do frontend
5. conversation_create → cria conversa com workflow "Code Review"
6. conversation_send_message → envia outputs anteriores para revisao

IMPORTANTE: Para workflows longos (>10min), use conversation_send_message_async.`,
    {
      id: z.string().describe('ID da conversa'),
      content: z.string().describe('Mensagem a enviar'),
      stepIndex: z.number().optional().describe('Indice do step (para step_by_step)'),
      timeoutMs: z.number().optional().describe('Timeout em ms (padrao: 600000 = 10min)'),
    },
    async ({ id, content, stepIndex, timeoutMs }) => {
      const body: Record<string, unknown> = { content }
      if (stepIndex !== undefined) body.stepIndex = stepIndex

      const result = await apiPostSSE(
        `/conversations/${id}/messages/stream`,
        body,
        { timeoutMs: timeoutMs || 600000 }
      )

      return formatResult(result)
    }
  )

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE ASYNC (fire-and-forget — returns immediately)
  // ─────────────────────────────────────────────────────────
  server.tool(
    'conversation_send_message_async',
    `Envia uma mensagem para uma conversa em BACKGROUND e retorna imediatamente.

A execucao continua no servidor MCP em background. Use conversation_await_execution
para esperar o resultado, ou conversation_status + conversation_messages para verificar.

IDEAL PARA:
- Disparar multiplas conversas em paralelo
- Workflows que demoram muito
- Swarm de agentes onde voce quer iniciar varios ao mesmo tempo

INPUT:
- id: ID da conversa (obrigatorio)
- content: Mensagem a enviar (obrigatorio)
- stepIndex: Indice do step (opcional, para step_by_step)

RETORNA: { conversationId, status: "started", startedAt }

FLUXO PARALELO:
1. conversation_send_message_async → conversa A (retorna imediato)
2. conversation_send_message_async → conversa B (retorna imediato)
3. conversation_await_execution → espera A terminar
4. conversation_await_execution → espera B terminar
5. Usa resultados de A e B para proxima etapa`,
    {
      id: z.string().describe('ID da conversa'),
      content: z.string().describe('Mensagem a enviar'),
      stepIndex: z.number().optional().describe('Indice do step (para step_by_step)'),
    },
    async ({ id, content, stepIndex }) => {
      // Check if there's already a background execution for this conversation
      if (backgroundExecutions.has(id)) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            conversationId: id,
            status: 'already_running',
            message: 'Ja existe uma execucao em background para esta conversa. Use conversation_await_execution para aguardar.',
          }, null, 2) }],
          isError: true,
        }
      }

      const body: Record<string, unknown> = { content }
      if (stepIndex !== undefined) body.stepIndex = stepIndex

      // Start SSE connection in background (keeps alive in MCP server process)
      const promise = apiPostSSE(`/conversations/${id}/messages/stream`, body)
      backgroundExecutions.set(id, { promise, startedAt: new Date() })

      // Clean up when done (regardless of success/failure)
      promise.finally(() => {
        backgroundExecutions.delete(id)
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          conversationId: id,
          status: 'started',
          startedAt: new Date().toISOString(),
          message: 'Execucao iniciada em background. Use conversation_await_execution para aguardar o resultado.',
        }, null, 2) }],
      }
    }
  )

  // ─────────────────────────────────────────────────────────
  // AWAIT EXECUTION (wait for async execution to complete)
  // ─────────────────────────────────────────────────────────
  server.tool(
    'conversation_await_execution',
    `Aguarda uma execucao em background (iniciada por conversation_send_message_async) terminar.

INPUT:
- id: ID da conversa (obrigatorio)
- timeoutMs: Timeout em ms (opcional, padrao: 600000 = 10min)

RETORNA:
- Se execucao em background existe: aguarda e retorna o resultado completo
- Se nao existe: retorna o status atual da conversa via API

USE apos conversation_send_message_async para coletar o resultado.`,
    {
      id: z.string().describe('ID da conversa'),
      timeoutMs: z.number().optional().describe('Timeout em ms (padrao: 600000 = 10min)'),
    },
    async ({ id, timeoutMs }) => {
      const bg = backgroundExecutions.get(id)

      if (!bg) {
        // No background execution — check status via API
        const status = await apiGet(`/conversations/${id}/status`)
        if (!status.ok) return formatResult(status)

        // If not executing, get the latest messages
        const messages = await apiGet(`/conversations/${id}/messages`)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            status: 'no_background_execution',
            executionStatus: status.data,
            latestMessages: messages.ok ? messages.data : null,
            message: 'Nenhuma execucao em background encontrada. Mostrando status atual e ultimas mensagens.',
          }, null, 2) }],
        }
      }

      // Wait for the background execution with optional timeout
      const timeout = timeoutMs || 600000
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('await_timeout')), timeout)
      })

      try {
        const result = await Promise.race([bg.promise, timeoutPromise])
        backgroundExecutions.delete(id)
        return formatResult(result)
      } catch (err) {
        if (err instanceof Error && err.message === 'await_timeout') {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              conversationId: id,
              status: 'still_running',
              runningFor: `${Date.now() - bg.startedAt.getTime()}ms`,
              message: `Execucao ainda em andamento apos ${timeout}ms. Chame conversation_await_execution novamente ou use conversation_status para verificar.`,
            }, null, 2) }],
          }
        }
        throw err
      }
    }
  )

  server.tool(
    'folders_list',
    `Lista as pastas de projetos disponiveis para criar conversas.

RETORNA: Array de pastas com name, path, conversationsCount.

USE para saber quais diretorios de projetos estao disponiveis.`,
    {},
    async () => formatResult(await apiGet('/folders'))
  )
}
