import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerPluginTools(server: McpServer) {
  server.tool(
    'plugin_list',
    `Lista todos os plugins instalados no sistema.

RETORNA: Array de plugins com id, name, description, version, author, enabled, mcpServersCount, skillsCount, agentsCount.

Plugins sao pacotes que agrupam MCP servers, skills e agentes. Podem ser importados do GitHub.`,
    {},
    async () => formatResult(await apiGet('/plugins'))
  )

  server.tool(
    'plugin_get',
    `Busca um plugin especifico pelo ID com detalhes completos.

RETORNA: Plugin com arrays de mcpServers, skills e agents filhos.`,
    { id: z.string().describe('ID do plugin') },
    async ({ id }) => formatResult(await apiGet(`/plugins/${id}`))
  )

  server.tool(
    'plugin_import_url',
    `Importa um plugin a partir de uma URL de repositorio GitHub.

O sistema escaneia o repo e importa automaticamente MCP servers, skills e agentes encontrados.

INPUT:
- url: URL do repositorio GitHub
- projectPath: Path local do projeto (opcional)

EXEMPLO:
{ "url": "https://github.com/user/my-plugin" }`,
    {
      url: z.string().describe('URL do repositorio GitHub'),
      projectPath: z.string().optional().describe('Path local do projeto'),
    },
    async (args) => formatResult(await apiPost('/plugins/import-url', args))
  )

  server.tool(
    'plugin_install',
    `Instala um plugin a partir de um manifest JSON.

INPUT:
- name: Nome do plugin
- description: Descricao
- version: Versao
- author: Autor
- manifest: Objeto com { mcpServers?, skills?, agents? }`,
    {
      name: z.string().describe('Nome do plugin'),
      description: z.string().optional().describe('Descricao'),
      version: z.string().optional().describe('Versao'),
      author: z.string().optional().describe('Autor'),
      manifest: z.object({
        mcpServers: z.array(z.unknown()).optional(),
        skills: z.array(z.unknown()).optional(),
        agents: z.array(z.unknown()).optional(),
      }).describe('Manifest com mcpServers, skills e agents'),
    },
    async (args) => formatResult(await apiPost('/plugins', args))
  )

  server.tool(
    'plugin_update',
    `Atualiza metadados de um plugin.`,
    {
      id: z.string().describe('ID do plugin'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      version: z.string().optional().describe('Nova versao'),
      author: z.string().optional().describe('Novo autor'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      projectPath: z.string().optional().describe('Novo projectPath'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/plugins/${id}`, body))
  )

  server.tool(
    'plugin_delete',
    `Desinstala um plugin e remove todos os filhos (MCP servers, skills, agents) em cascata.

CUIDADO: Acao irreversivel.`,
    { id: z.string().describe('ID do plugin a desinstalar') },
    async ({ id }) => formatResult(await apiDelete(`/plugins/${id}`))
  )

  server.tool(
    'plugin_toggle',
    `Ativa ou desativa um plugin e todos seus filhos em cascata.`,
    { id: z.string().describe('ID do plugin') },
    async ({ id }) => formatResult(await apiPatch(`/plugins/${id}/toggle`))
  )

  server.tool(
    'plugin_resync',
    `Re-sincroniza um plugin importado do GitHub, atualizando todos os componentes.

RETORNA: { id, name, filesUpdated, lastSyncedAt }`,
    {
      id: z.string().describe('ID do plugin'),
      projectPath: z.string().optional().describe('Path do projeto (opcional)'),
    },
    async ({ id, ...body }) => formatResult(await apiPost(`/plugins/${id}/resync`, body))
  )
}
