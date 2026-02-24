import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerMcpServerTools(server: McpServer) {
  server.tool(
    'mcp_server_list',
    `Lista todos os MCP servers configurados no sistema.

RETORNA: Array de MCP servers com id, name, description, type (http/sse/stdio), uri, enabled, isGlobal.

MCP servers sao servicos externos que fornecem tools adicionais aos workflows.`,
    {},
    async () => formatResult(await apiGet('/mcp-servers'))
  )

  server.tool(
    'mcp_server_get',
    `Busca um MCP server especifico pelo ID com detalhes completos.

RETORNA: MCP server com args, envVars, toolsCache, tipo de conexao.`,
    { id: z.string().describe('ID do MCP server') },
    async ({ id }) => formatResult(await apiGet(`/mcp-servers/${id}`))
  )

  server.tool(
    'mcp_server_create',
    `Registra um novo MCP server no sistema.

INPUT:
- name: Nome do server (obrigatorio)
- description: Descricao do que faz
- type: "http", "sse" ou "stdio" (default: http)
- uri: URL do server (para http/sse)
- command: Comando de execucao (para stdio, ex: "npx -y @mcp/server")
- args: Array de argumentos CLI
- envVars: Objeto com variaveis de ambiente { chave: valor }
- enabled: Se esta ativo
- isGlobal: Se aparece em todos os workflows

EXEMPLO HTTP:
{ "name": "Browser", "type": "http", "uri": "http://localhost:8080/mcp" }

EXEMPLO STDIO:
{ "name": "FS Server", "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"] }`,
    {
      name: z.string().describe('Nome do MCP server'),
      description: z.string().optional().describe('Descricao'),
      type: z.enum(['http', 'sse', 'stdio']).optional().describe('Tipo: http, sse ou stdio'),
      uri: z.string().optional().describe('URL do server (http/sse)'),
      command: z.string().optional().describe('Comando (stdio)'),
      args: z.array(z.string()).optional().describe('Argumentos CLI'),
      envVars: z.record(z.string()).optional().describe('Variaveis de ambiente'),
      enabled: z.boolean().optional().describe('Se esta ativo'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/mcp-servers', args))
  )

  server.tool(
    'mcp_server_update',
    `Atualiza um MCP server existente.`,
    {
      id: z.string().describe('ID do MCP server'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      type: z.enum(['http', 'sse', 'stdio']).optional().describe('Novo tipo'),
      uri: z.string().optional().describe('Nova URL'),
      command: z.string().optional().describe('Novo comando'),
      args: z.array(z.string()).optional().describe('Novos argumentos'),
      envVars: z.record(z.string()).optional().describe('Novas envVars'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      isGlobal: z.boolean().optional().describe('Tornar global ou nao'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/mcp-servers/${id}`, body))
  )

  server.tool(
    'mcp_server_delete',
    `Deleta um MCP server permanentemente.`,
    { id: z.string().describe('ID do MCP server a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/mcp-servers/${id}`))
  )

  server.tool(
    'mcp_server_toggle',
    `Ativa ou desativa um MCP server (toggle).`,
    { id: z.string().describe('ID do MCP server') },
    async ({ id }) => formatResult(await apiPatch(`/mcp-servers/${id}/toggle`))
  )

  server.tool(
    'mcp_server_test',
    `Testa a conexao com um MCP server e retorna as tools disponiveis.

RETORNA: { ok: boolean, tools?: array, error?: string }

USE para verificar se um MCP server esta funcionando e quais tools ele oferece.`,
    { id: z.string().describe('ID do MCP server a testar') },
    async ({ id }) => formatResult(await apiPost(`/mcp-servers/${id}/test`))
  )

  server.tool(
    'mcp_server_quick_install',
    `Instala rapidamente um MCP server a partir de um comando (ex: "npx -y @mcp/server").

O sistema detecta automaticamente o tipo e configura o server.

INPUT:
- command: Comando completo de instalacao
- name: Nome customizado (opcional, auto-detectado)
- description: Descricao (opcional)
- envVars: Variaveis de ambiente necessarias
- isGlobal: Se e global

EXEMPLO:
{ "command": "npx -y @modelcontextprotocol/server-filesystem /workspace" }`,
    {
      command: z.string().describe('Comando de instalacao do MCP server'),
      name: z.string().optional().describe('Nome customizado'),
      description: z.string().optional().describe('Descricao'),
      envVars: z.record(z.string()).optional().describe('Variaveis de ambiente'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/mcp-servers/quick-install', args))
  )
}
