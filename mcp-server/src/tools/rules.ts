import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerRuleTools(server: McpServer) {
  server.tool(
    'rule_list',
    `Lista todas as rules do sistema.

RETORNA: Array de rules com id, name, description, enabled, isGlobal, skillId.

Rules sao regras/diretrizes que podem ser aplicadas a steps de workflows para guiar o comportamento da IA.`,
    {},
    async () => formatResult(await apiGet('/rules'))
  )

  server.tool(
    'rule_get',
    `Busca uma rule especifica pelo ID com detalhes completos, incluindo o body (conteudo).`,
    { id: z.string().describe('ID da rule') },
    async ({ id }) => formatResult(await apiGet(`/rules/${id}`))
  )

  server.tool(
    'rule_create',
    `Cria uma nova rule no sistema.

INPUT:
- name: Nome da rule (obrigatorio)
- description: Descricao do proposito
- body: Conteudo da rule (instrucoes, diretrizes)
- enabled: Se esta ativa (default: true)
- isGlobal: Se se aplica globalmente
- skillId: ID de skill associada (opcional)

EXEMPLO:
{
  "name": "Seguranca",
  "description": "Regras de seguranca para codigo",
  "body": "Nunca exponha credenciais. Sempre valide inputs. Use parametros preparados em queries SQL."
}`,
    {
      name: z.string().describe('Nome da rule'),
      description: z.string().optional().describe('Descricao'),
      body: z.string().optional().describe('Conteudo da rule'),
      enabled: z.boolean().optional().describe('Se esta ativa'),
      isGlobal: z.boolean().optional().describe('Se e global'),
      skillId: z.string().optional().describe('ID de skill associada'),
    },
    async (args) => formatResult(await apiPost('/rules', args))
  )

  server.tool(
    'rule_update',
    `Atualiza uma rule existente. Todos os campos sao opcionais.`,
    {
      id: z.string().describe('ID da rule'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      body: z.string().optional().describe('Novo conteudo'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      isGlobal: z.boolean().optional().describe('Tornar global ou nao'),
      skillId: z.string().optional().describe('Novo skillId associado'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/rules/${id}`, body))
  )

  server.tool(
    'rule_delete',
    `Deleta uma rule permanentemente.`,
    { id: z.string().describe('ID da rule a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/rules/${id}`))
  )

  server.tool(
    'rule_toggle',
    `Ativa ou desativa uma rule (toggle).`,
    { id: z.string().describe('ID da rule') },
    async ({ id }) => formatResult(await apiPatch(`/rules/${id}/toggle`))
  )

  server.tool(
    'rule_import',
    `Importa uma rule a partir de uma URL do GitHub ou conteudo markdown direto.`,
    {
      url: z.string().optional().describe('URL do GitHub'),
      content: z.string().optional().describe('Conteudo markdown'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/rules/import', args))
  )
}
