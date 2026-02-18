import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { execSync } from 'child_process'
import { prisma } from '../../../lib/prisma.js'

export async function quickInstallMcpServer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/mcp-servers/quick-install',
    {
      schema: {
        tags: ['MCP Servers'],
        summary: 'Quick install MCP server from a command string (e.g. npx -y @mcp/server)',
        body: z.object({
          command: z.string().min(1, 'Comando obrigatorio'),
          name: z.string().optional(),
          description: z.string().optional(),
          envVars: z.record(z.string()).default({}),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            command: z.string(),
            args: z.array(z.string()),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { command: rawCommand, name: customName, description, envVars, isGlobal } = request.body

      // Parse the command string
      // Examples:
      //   "npx -y @modelcontextprotocol/server-filesystem /allowed/path"
      //   "npx @anthropic/mcp-server-git"
      //   "node /path/to/server.js"
      //   "uvx mcp-server-sqlite --db-path /tmp/test.db"
      //   "docker run -i mcp/fetch"
      const parts = parseCommand(rawCommand.trim())
      if (parts.length === 0) {
        throw new Error('Comando vazio')
      }

      const bin = parts[0]
      const args = parts.slice(1)

      // Try to extract a package name for the display name
      const packageName = extractPackageName(parts)

      // Try to get npm package info if it looks like an npm package
      let npmDescription: string | undefined
      if (packageName && (bin === 'npx' || bin === 'npx.cmd')) {
        try {
          const info = execSync(`npm info ${packageName} description 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 10000,
          }).trim()
          if (info && !info.includes('ERR')) {
            npmDescription = info
          }
        } catch {
          // Not an npm package or no internet — that's fine
        }
      }

      const serverName = customName || packageName || bin
      const serverDescription = description || npmDescription || `Instalado via: ${rawCommand}`

      const server = await prisma.mcpServer.create({
        data: {
          name: serverName,
          description: serverDescription,
          type: 'stdio',
          command: bin,
          args: JSON.stringify(args),
          envVars: JSON.stringify(envVars),
          enabled: true,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: server.id,
        name: server.name,
        type: server.type,
        command: bin,
        args,
        createdAt: server.createdAt.toISOString(),
      })
    }
  )
}

/**
 * Parse a command string into parts, respecting quotes.
 * "npx -y @mcp/server 'path with spaces'" → ["npx", "-y", "@mcp/server", "path with spaces"]
 */
function parseCommand(cmd: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

/**
 * Extract the npm package name from a command.
 * "npx -y @modelcontextprotocol/server-filesystem /path" → "@modelcontextprotocol/server-filesystem"
 * "uvx mcp-server-sqlite --db-path /tmp" → "mcp-server-sqlite"
 */
function extractPackageName(parts: string[]): string | null {
  // Skip the binary and any flags
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    // Skip flags like -y, --yes, -p, etc
    if (part.startsWith('-')) continue
    // This is likely the package/command name
    // It could be @scope/name or just a name
    if (part.startsWith('@') || /^[a-z0-9]/.test(part)) {
      // Don't return file paths
      if (part.startsWith('/') || part.startsWith('./') || part.startsWith('..')) continue
      return part
    }
  }
  return null
}
