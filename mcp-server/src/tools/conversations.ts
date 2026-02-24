import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiDelete, formatResult } from '../api-client.js'

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

  server.tool(
    'folders_list',
    `Lista as pastas de projetos disponiveis para criar conversas.

RETORNA: Array de pastas com name, path, conversationsCount.

USE para saber quais diretorios de projetos estao disponiveis.`,
    {},
    async () => formatResult(await apiGet('/folders'))
  )
}
