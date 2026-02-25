import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, formatResult } from '../api-client.js'

const stepSchema = z.object({
  name: z.string().describe('Nome do step'),
  baseUrl: z.string().optional().describe('URL base do step (se diferente do workflow)'),
  systemPrompt: z.string().optional().describe('System prompt customizado para este step'),
  maxRetries: z.number().optional().describe('Maximo de retries em caso de falha'),
  backend: z.enum(['claude', 'api']).optional().describe('Backend: claude (CLI) ou api (Anthropic API)'),
  model: z.string().optional().describe('Modelo a usar (ex: claude-sonnet-4-20250514)'),
  mcpServerIds: z.array(z.string()).optional().describe('IDs dos MCP servers disponiveis neste step'),
  skillIds: z.array(z.string()).optional().describe('IDs das skills ativas neste step'),
  agentIds: z.array(z.string()).optional().describe('IDs dos agentes disponiveis neste step'),
  ruleIds: z.array(z.string()).optional().describe('IDs das rules ativas neste step'),
  hookIds: z.array(z.string()).optional().describe('IDs dos hooks ativos neste step'),
  conditions: z.unknown().optional().describe('Condicoes de avaliacao do output (JSON)'),
})

export function registerWorkflowTools(server: McpServer) {
  server.tool(
    'workflow_list',
    `Lista todos os workflows do sistema.

RETORNA: Array de workflows com id, name, description, type, stepsCount, conversationsCount.

USE PRIMEIRO para entender os workflows disponiveis antes de criar ou modificar.`,
    {},
    async () => formatResult(await apiGet('/workflows'))
  )

  server.tool(
    'workflow_get',
    `Busca um workflow especifico pelo ID com todos os detalhes, incluindo steps completos.

RETORNA: Workflow completo com steps, configuracoes de cada step (systemPrompt, model, skills, agents, rules, mcpServers, conditions).

USE para inspecionar a configuracao detalhada de um workflow.`,
    { id: z.string().describe('ID do workflow') },
    async ({ id }) => formatResult(await apiGet(`/workflows/${id}`))
  )

  server.tool(
    'workflow_create',
    `Cria um novo workflow no sistema.

INPUT:
- name: Nome do workflow (obrigatorio)
- description: Descricao do proposito
- type: "sequential" (executa todos os steps automaticamente) ou "step_by_step" (usuario controla avanco)
- steps: Array de steps com configuracoes (nome, systemPrompt, model, skills, agents, rules, mcpServers, conditions)

EXEMPLO:
{
  "name": "Code Review",
  "type": "sequential",
  "steps": [
    { "name": "Analise", "systemPrompt": "Analise o codigo...", "model": "claude-sonnet-4-20250514" },
    { "name": "Sugestoes", "systemPrompt": "Sugira melhorias..." }
  ]
}

WORKFLOW: workflow_list -> workflow_create -> workflow_get (para confirmar)`,
    {
      name: z.string().describe('Nome do workflow'),
      description: z.string().optional().describe('Descricao do workflow'),
      type: z.enum(['sequential', 'step_by_step']).optional().describe('Tipo: sequential ou step_by_step (default: sequential)'),
      steps: z.array(stepSchema).optional().describe('Array de steps do workflow'),
    },
    async (args) => formatResult(await apiPost('/workflows', args))
  )

  server.tool(
    'workflow_update',
    `Atualiza um workflow existente. Pode atualizar nome, descricao, tipo e steps.

IMPORTANTE: Ao atualizar steps, envie o array COMPLETO de steps (substituicao total).

USE workflow_get antes para ver o estado atual.`,
    {
      id: z.string().describe('ID do workflow'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      type: z.enum(['sequential', 'step_by_step']).optional().describe('Novo tipo'),
      steps: z.array(stepSchema).optional().describe('Novos steps (substituicao completa)'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/workflows/${id}`, body))
  )

  server.tool(
    'workflow_delete',
    `Deleta um workflow permanentemente.

CUIDADO: Acao irreversivel. Todas as conversas associadas tambem serao afetadas.`,
    { id: z.string().describe('ID do workflow a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/workflows/${id}`))
  )

  server.tool(
    'workflow_duplicate',
    `Duplica um workflow existente, criando uma copia identica com novo ID.

UTIL para criar variacoes de workflows existentes sem afetar o original.`,
    { id: z.string().describe('ID do workflow a duplicar') },
    async ({ id }) => formatResult(await apiPost(`/workflows/${id}/duplicate`))
  )
}
