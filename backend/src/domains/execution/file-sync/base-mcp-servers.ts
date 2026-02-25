/**
 * Base MCP Servers - Hardcoded
 *
 * Estes MCP servers sao injetados em TODOS os projetos, independente do workflow ou step.
 * Garante que tools essenciais do ambiente (ex: gerenciamento de dominios) estejam sempre disponiveis.
 *
 * Para adicionar/remover MCP servers base, modifique APENAS o array BASE_MCP_SERVERS abaixo.
 * Nenhum outro arquivo precisa ser alterado.
 */

interface BaseMcpServer {
  name: string
  type: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

const BASE_MCP_SERVERS: BaseMcpServer[] = [
  {
    name: 'mcp-easypanel',
    type: 'http',
    url: 'https://nommand-mcp-easypanel.ddw1sl.easypanel.host/mcp',
  },
]

/**
 * Retorna os MCP servers base como entries para o .mcp.json
 * Formato: { "nome": { type, url, ... } }
 */
export function getBaseMcpEntries(): Record<string, unknown> {
  const entries: Record<string, unknown> = {}

  for (const server of BASE_MCP_SERVERS) {
    if ((server.type === 'http' || server.type === 'sse') && server.url) {
      const entry: Record<string, unknown> = {
        type: server.type,
        url: server.url,
      }
      if (server.headers && Object.keys(server.headers).length > 0) {
        entry.headers = server.headers
      }
      entries[server.name] = entry
    } else if (server.type === 'stdio' && server.command) {
      const entry: Record<string, unknown> = {
        command: server.command,
        args: server.args || [],
      }
      if (server.env && Object.keys(server.env).length > 0) {
        entry.env = server.env
      }
      entries[server.name] = entry
    }
  }

  return entries
}

/**
 * Retorna os nomes dos MCP servers base (para deduplicacao).
 */
export function getBaseMcpNames(): Set<string> {
  return new Set(BASE_MCP_SERVERS.map((s) => s.name))
}
