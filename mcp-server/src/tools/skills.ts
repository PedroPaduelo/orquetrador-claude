import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerSkillTools(server: McpServer) {
  server.tool(
    'skill_list',
    `Lista todas as skills do sistema.

RETORNA: Array de skills com id, name, description, enabled, isGlobal.

Skills sao prompts/instrucoes reutilizaveis que podem ser atribuidas a steps de workflows ou agentes.`,
    {},
    async () => formatResult(await apiGet('/skills'))
  )

  server.tool(
    'skill_get',
    `Busca uma skill especifica pelo ID com detalhes completos, incluindo o body (conteudo markdown).`,
    { id: z.string().describe('ID da skill') },
    async ({ id }) => formatResult(await apiGet(`/skills/${id}`))
  )

  server.tool(
    'skill_create',
    `Cria uma nova skill no sistema.

INPUT:
- name: Nome da skill (obrigatorio)
- description: O que esta skill faz
- body: Conteudo markdown da skill (instrucoes, prompts, regras)
- allowedTools: Tools que a skill pode usar
- model: Modelo recomendado
- enabled: Se esta ativa (default: true)
- isGlobal: Se aparece em todos os contextos (default: false)

EXEMPLO:
{
  "name": "Code Review Skill",
  "description": "Skill para revisao detalhada de codigo",
  "body": "# Code Review\\n\\nAo revisar codigo, verifique:\\n1. Seguranca\\n2. Performance\\n3. Legibilidade"
}`,
    {
      name: z.string().describe('Nome da skill'),
      description: z.string().optional().describe('Descricao da skill'),
      body: z.string().optional().describe('Conteudo markdown da skill'),
      allowedTools: z.array(z.string()).optional().describe('Tools permitidas'),
      model: z.string().optional().describe('Modelo recomendado'),
      enabled: z.boolean().optional().describe('Se esta ativa'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/skills', args))
  )

  server.tool(
    'skill_update',
    `Atualiza uma skill existente. Todos os campos sao opcionais.`,
    {
      id: z.string().describe('ID da skill'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      body: z.string().optional().describe('Novo conteudo markdown'),
      allowedTools: z.array(z.string()).optional().describe('Novas tools permitidas'),
      model: z.string().optional().describe('Novo modelo'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      isGlobal: z.boolean().optional().describe('Tornar global ou nao'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/skills/${id}`, body))
  )

  server.tool(
    'skill_delete',
    `Deleta uma skill permanentemente.`,
    { id: z.string().describe('ID da skill a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/skills/${id}`))
  )

  server.tool(
    'skill_toggle',
    `Ativa ou desativa uma skill (toggle).`,
    { id: z.string().describe('ID da skill') },
    async ({ id }) => formatResult(await apiPatch(`/skills/${id}/toggle`))
  )

  server.tool(
    'skill_import',
    `Importa uma skill a partir de uma URL do GitHub ou conteudo markdown direto.

INPUT (pelo menos um obrigatorio):
- url: URL do GitHub (raw ou blob)
- content: Conteudo markdown direto
- isGlobal: Se deve ser global`,
    {
      url: z.string().optional().describe('URL do GitHub'),
      content: z.string().optional().describe('Conteudo markdown'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/skills/import', args))
  )
}
