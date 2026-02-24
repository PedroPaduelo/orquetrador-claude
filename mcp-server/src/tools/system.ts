import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, formatResult } from '../api-client.js'

export function registerSystemTools(server: McpServer) {
  server.tool(
    'health_check',
    `Verifica a saude do sistema Execut.

RETORNA: { status, timestamp, database }
- database: "connected", "disconnected" ou "error"

USE PRIMEIRO para verificar se o sistema esta operacional antes de qualquer operacao.`,
    {},
    async () => formatResult(await apiGet('/health'))
  )

  server.tool(
    'import_repo',
    `Escaneia um repositorio GitHub e importa em massa skills, agentes e rules encontrados.

INPUT:
- url: URL do repositorio GitHub
- projectPath: Path local do projeto
- saveToDb: Se salva no banco (default: true)

RETORNA:
- imported: Array de { type, name, filesCount } importados
- skipped: Array de { type, name, reason } pulados
- errors: Array de { path, error } com erros

USE para importar configuracoes de um repo GitHub de uma vez.`,
    {
      url: z.string().describe('URL do repositorio GitHub'),
      projectPath: z.string().describe('Path local do projeto'),
      saveToDb: z.boolean().optional().describe('Salvar no banco (default: true)'),
    },
    async (args) => formatResult(await apiPost('/import-repo', args))
  )

  server.tool(
    'system_overview',
    `Obtem uma visao geral completa do sistema com contagens de cada entidade.

Faz chamadas paralelas para contar workflows, agents, skills, rules, mcp-servers, plugins e conversations.

RETORNA: Resumo com contagens de cada tipo de entidade.

USE como ponto de partida para entender o estado atual do sistema.`,
    {},
    async () => {
      const [workflows, agents, skills, rules, mcpServers, plugins, conversations] = await Promise.all([
        apiGet<unknown[]>('/workflows'),
        apiGet<unknown[]>('/agents'),
        apiGet<unknown[]>('/skills'),
        apiGet<unknown[]>('/rules'),
        apiGet<unknown[]>('/mcp-servers'),
        apiGet<unknown[]>('/plugins'),
        apiGet<unknown[]>('/conversations'),
      ])

      const overview = {
        system: 'Execut Orchestrator',
        counts: {
          workflows: Array.isArray(workflows.data) ? workflows.data.length : 0,
          agents: Array.isArray(agents.data) ? agents.data.length : 0,
          skills: Array.isArray(skills.data) ? skills.data.length : 0,
          rules: Array.isArray(rules.data) ? rules.data.length : 0,
          mcpServers: Array.isArray(mcpServers.data) ? mcpServers.data.length : 0,
          plugins: Array.isArray(plugins.data) ? plugins.data.length : 0,
          conversations: Array.isArray(conversations.data) ? conversations.data.length : 0,
        },
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }],
      }
    }
  )
}
