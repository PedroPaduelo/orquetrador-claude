import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function importPluginUrl(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/plugins/import-url',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Import a plugin from a manifest URL',
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            mcpServersCount: z.number(),
            skillsCount: z.number(),
            agentsCount: z.number(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body

      // Fetch manifest
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      let manifest: PluginManifest
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Erro ao buscar URL: ${response.status} ${response.statusText}`)
        }
        manifest = await response.json() as PluginManifest
      } finally {
        clearTimeout(timeout)
      }

      if (!manifest.name) {
        throw new Error('Manifesto invalido: campo "name" obrigatorio')
      }

      // Check uniqueness
      const existing = await prisma.plugin.findUnique({ where: { name: manifest.name } })
      if (existing) {
        throw new Error(`Plugin com nome "${manifest.name}" ja existe`)
      }

      const mcpServers = manifest.mcpServers || []
      const skills = manifest.skills || []
      const agents = manifest.agents || []

      const plugin = await prisma.plugin.create({
        data: {
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author,
          manifest: JSON.stringify(manifest),
          mcpServers: {
            create: mcpServers.map((s) => ({
              name: s.name,
              description: s.description,
              type: s.type || 'stdio',
              uri: s.uri,
              command: s.command,
              args: JSON.stringify(s.args || []),
              envVars: JSON.stringify(s.envVars || {}),
            })),
          },
          skills: {
            create: skills.map((s) => ({
              name: s.name,
              description: s.description,
              body: s.body || '',
              allowedTools: JSON.stringify(s.allowedTools || []),
              model: s.model,
            })),
          },
          agents: {
            create: agents.map((a) => ({
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt || '',
              tools: JSON.stringify(a.tools || []),
              disallowedTools: JSON.stringify(a.disallowedTools || []),
              model: a.model,
              permissionMode: a.permissionMode || 'default',
              maxTurns: a.maxTurns,
              skills: JSON.stringify(a.skills || []),
            })),
          },
        },
        include: {
          _count: { select: { mcpServers: true, skills: true, agents: true } },
        },
      })

      return reply.status(201).send({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        mcpServersCount: plugin._count.mcpServers,
        skillsCount: plugin._count.skills,
        agentsCount: plugin._count.agents,
        createdAt: plugin.createdAt.toISOString(),
      })
    }
  )
}

interface PluginManifest {
  name: string
  description?: string
  version?: string
  author?: string
  mcpServers?: Array<{
    name: string
    description?: string
    type?: string
    uri?: string
    command?: string
    args?: string[]
    envVars?: Record<string, string>
  }>
  skills?: Array<{
    name: string
    description?: string
    body?: string
    allowedTools?: string[]
    model?: string
  }>
  agents?: Array<{
    name: string
    description?: string
    systemPrompt?: string
    tools?: string[]
    disallowedTools?: string[]
    model?: string
    permissionMode?: string
    maxTurns?: number
    skills?: string[]
  }>
}
