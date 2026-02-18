import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function installPlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/plugins',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Install a plugin from manifest',
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          version: z.string().optional(),
          author: z.string().optional(),
          manifest: z.object({
            mcpServers: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              type: z.enum(['http', 'sse', 'stdio']).default('http'),
              uri: z.string().optional(),
              command: z.string().optional(),
              args: z.array(z.string()).default([]),
              envVars: z.record(z.string()).default({}),
            })).default([]),
            skills: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              body: z.string().default(''),
              allowedTools: z.array(z.string()).default([]),
              model: z.string().optional(),
            })).default([]),
            agents: z.array(z.object({
              name: z.string(),
              description: z.string().optional(),
              systemPrompt: z.string().default(''),
              tools: z.array(z.string()).default([]),
              disallowedTools: z.array(z.string()).default([]),
              model: z.string().optional(),
              permissionMode: z.string().default('default'),
              maxTurns: z.number().optional(),
              skills: z.array(z.string()).default([]),
            })).default([]),
          }),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, description, version, author, manifest } = request.body

      const plugin = await prisma.plugin.create({
        data: {
          name,
          description,
          version,
          author,
          manifest: JSON.stringify(manifest),
          mcpServers: {
            create: manifest.mcpServers.map((s) => ({
              name: s.name,
              description: s.description,
              type: s.type,
              uri: s.uri,
              command: s.command,
              args: JSON.stringify(s.args),
              envVars: JSON.stringify(s.envVars),
            })),
          },
          skills: {
            create: manifest.skills.map((s) => ({
              name: s.name,
              description: s.description,
              body: s.body,
              allowedTools: JSON.stringify(s.allowedTools),
              model: s.model,
            })),
          },
          agents: {
            create: manifest.agents.map((a) => ({
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt,
              tools: JSON.stringify(a.tools),
              disallowedTools: JSON.stringify(a.disallowedTools),
              model: a.model,
              permissionMode: a.permissionMode,
              maxTurns: a.maxTurns,
              skills: JSON.stringify(a.skills),
            })),
          },
        },
      })

      return reply.status(201).send({
        id: plugin.id,
        name: plugin.name,
        createdAt: plugin.createdAt.toISOString(),
      })
    }
  )
}
