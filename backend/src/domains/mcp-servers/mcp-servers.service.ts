import { execSync } from 'child_process'
import { mcpServersRepository } from './mcp-servers.repository.js'

function parseCommand(cmd: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]
    if (inQuote) {
      if (ch === inQuote) inQuote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) { parts.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function extractPackageName(parts: string[]): string | null {
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('-')) continue
    if (part.startsWith('@') || /^[a-z0-9]/.test(part)) {
      if (part.startsWith('/') || part.startsWith('./') || part.startsWith('..')) continue
      return part
    }
  }
  return null
}

export const mcpServersService = {
  async test(id: string) {
    const server = await mcpServersRepository.findById(id)
    if (!server) return null

    try {
      if ((server.type === 'http' || server.type === 'sse') && server.uri) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(server.uri, {
          method: 'GET',
          signal: controller.signal,
        }).catch(() => null)

        clearTimeout(timeout)

        const ok = response !== null && response.status < 500
        await mcpServersRepository.updateTestResult(id, ok)

        return { ok, tools: [] as Array<{ name: string; description?: string }> }
      }

      if (server.type === 'stdio' && server.command) {
        await mcpServersRepository.updateTestResult(id, true)
        return { ok: true, tools: [] as Array<{ name: string; description?: string }> }
      }

      return { ok: false, error: 'Invalid server configuration' }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      await mcpServersRepository.updateTestResult(id, false)
      return { ok: false, error: errorMessage }
    }
  },

  async quickInstall(input: {
    command: string
    name?: string
    description?: string
    envVars?: Record<string, string>
    isGlobal?: boolean
  }, userId: string) {
    const parts = parseCommand(input.command.trim())
    if (parts.length === 0) throw new Error('Comando vazio')

    const bin = parts[0]
    const args = parts.slice(1)
    const packageName = extractPackageName(parts)

    let npmDescription: string | undefined
    if (packageName && (bin === 'npx' || bin === 'npx.cmd')) {
      try {
        const info = execSync(`npm info ${packageName} description 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 10000,
        }).trim()
        if (info && !info.includes('ERR')) npmDescription = info
      } catch { /* Not an npm package or no internet */ }
    }

    const serverName = input.name || packageName || bin
    const serverDescription = input.description || npmDescription || `Instalado via: ${input.command}`

    return mcpServersRepository.create({
      name: serverName,
      description: serverDescription,
      type: 'stdio',
      command: bin,
      args,
      envVars: input.envVars ?? {},
      enabled: true,
      isGlobal: input.isGlobal ?? true,
    }, userId)
  },
}
