import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPut, apiDelete, formatResult } from '../api-client.js'

export function registerExecutionTraceTools(server: McpServer) {
  // ==================== TRACES (PRIORIDADE - INVESTIGACAO E MONITORAMENTO) ====================

  server.tool(
    'trace_list',
    `Lista todos os traces de execucao de uma conversa, ordenados por data (mais recente primeiro).

RETORNA: Array de traces com:
- id: ID unico do trace
- executionId: ID da execucao pai
- stepId: ID do step executado
- resultStatus: "success", "error", "timeout", "cancelled"
- durationMs: Duracao em milissegundos (null se nao completou)
- contentLength: Tamanho do conteudo gerado
- actionsCount: Numero de acoes (tool calls) realizadas
- errorMessage: Mensagem de erro (null se sucesso)
- createdAt: Timestamp

USE PARA:
- Investigar falhas em execucoes
- Analisar performance (durationMs, contentLength)
- Verificar quais steps falharam e por que
- Monitorar saude do sistema

WORKFLOW: conversation_list -> trace_list -> trace_get_detail (para investigar falhas)`,
    { conversationId: z.string().describe('ID da conversa') },
    async ({ conversationId }) => formatResult(await apiGet(`/conversations/${conversationId}/traces`))
  )

  server.tool(
    'trace_get_detail',
    `Busca detalhes COMPLETOS de um trace de execucao. Esta e a tool mais importante para investigacao.

RETORNA todos os dados de uma execucao:
- commandLine: Comando executado (ex: "claude --model claude-sonnet-4-20250514 ...")
- stdoutRaw: Saida completa do processo (STDOUT bruto)
- stderrRaw: Erros do processo (STDERR bruto)
- parsedEvents: Eventos parseados do stream (JSON)
- systemPrompt: System prompt usado
- model: Modelo utilizado
- projectPath: Diretorio de trabalho

TIMING:
- startedAt: Inicio da execucao
- firstByteAt: Primeiro byte recebido
- firstContentAt: Primeiro conteudo util recebido
- completedAt: Fim da execucao
- durationMs: Duracao total

PROCESSO:
- pid: PID do processo
- exitCode: Codigo de saida (0 = sucesso)
- signal: Sinal recebido (SIGTERM, SIGKILL, etc.)

RESULTADO:
- resultStatus: "success", "error", "timeout", "cancelled"
- errorMessage: Mensagem de erro detalhada
- contentLength: Tamanho do conteudo gerado
- actionsCount: Numero de acoes realizadas

TOKENS:
- resumeToken: Token para resumir sessao
- resumeTokenOut: Token de saida para proxima sessao

USE PARA:
- Investigar POR QUE uma execucao falhou (ver stderrRaw, errorMessage, exitCode)
- Analisar O QUE a IA fez (parsedEvents mostra cada acao)
- Verificar o PROMPT usado (systemPrompt)
- Medir PERFORMANCE (timing fields)
- Debug de problemas com o CLI (commandLine, exitCode, signal)`,
    { traceId: z.string().describe('ID do trace') },
    async ({ traceId }) => formatResult(await apiGet(`/traces/${traceId}`))
  )

  // ==================== MENSAGENS (GERENCIAMENTO) ====================

  server.tool(
    'message_toggle_context',
    `Marca ou desmarca uma mensagem para ser incluida no contexto de futuras execucoes.

INPUT:
- messageId: ID da mensagem
- selected: true para incluir no contexto, false para excluir

USE para controlar quais mensagens a IA recebe como contexto nas proximas interacoes.`,
    {
      messageId: z.string().describe('ID da mensagem'),
      selected: z.boolean().describe('true = incluir no contexto, false = excluir'),
    },
    async ({ messageId, selected }) => formatResult(await apiPut(`/messages/${messageId}/select`, { selected }))
  )

  server.tool(
    'message_update_actions',
    `Atualiza os metadados de acoes de uma mensagem.

USE para anotar ou categorizar acoes realizadas em uma mensagem.`,
    {
      messageId: z.string().describe('ID da mensagem'),
      actions: z.array(z.unknown()).describe('Array de acoes (metadata livre)'),
    },
    async ({ messageId, actions }) => formatResult(await apiPut(`/messages/${messageId}/actions`, { actions }))
  )

  server.tool(
    'message_delete',
    `Deleta uma mensagem permanentemente.`,
    { messageId: z.string().describe('ID da mensagem a deletar') },
    async ({ messageId }) => formatResult(await apiDelete(`/messages/${messageId}`))
  )
}
