import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function importAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/agents/import',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Import an agent from a URL (raw agent.md) or pasted markdown content',
        body: z.object({
          url: z.string().url().optional(),
          content: z.string().optional(),
          isGlobal: z.boolean().default(true),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { url, content: rawContent, isGlobal } = request.body

      if (!url && !rawContent) {
        throw new Error('Informe url ou content')
      }

      let markdown: string

      if (url) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        try {
          const response = await fetch(url, { signal: controller.signal })
          if (!response.ok) {
            throw new Error(`Erro ao buscar URL: ${response.status} ${response.statusText}`)
          }
          markdown = await response.text()
        } finally {
          clearTimeout(timeout)
        }
      } else {
        markdown = rawContent!
      }

      // Parse frontmatter
      const { frontmatter, body } = parseFrontmatter(markdown)

      const name = frontmatter.name as string || extractNameFromUrl(url) || `agent-${Date.now()}`
      const description = (frontmatter.description as string) || null
      const model = (frontmatter.model as string) || null
      const permissionMode = (frontmatter['permission-mode'] as string) || (frontmatter.permissionMode as string) || 'default'
      const maxTurns = frontmatter['max-turns'] || frontmatter.maxTurns
      const tools = frontmatter.tools || []
      const disallowedTools = frontmatter['disallowed-tools'] || frontmatter.disallowedTools || []
      const skills = frontmatter.skills || []

      // Check uniqueness
      const existing = await prisma.agent.findUnique({ where: { name } })
      if (existing) {
        throw new Error(`Agent com nome "${name}" ja existe`)
      }

      const agent = await prisma.agent.create({
        data: {
          name,
          description,
          systemPrompt: body,
          tools: JSON.stringify(Array.isArray(tools) ? tools : []),
          disallowedTools: JSON.stringify(Array.isArray(disallowedTools) ? disallowedTools : []),
          model: typeof model === 'string' ? model : null,
          permissionMode,
          maxTurns: maxTurns ? parseInt(String(maxTurns), 10) || null : null,
          skills: JSON.stringify(Array.isArray(skills) ? skills : []),
          enabled: true,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        createdAt: agent.createdAt.toISOString(),
      })
    }
  )
}

interface Frontmatter {
  [key: string]: unknown
}

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = markdown.trim()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: trimmed }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, body: trimmed }
  }

  const yamlBlock = trimmed.substring(3, endIndex).trim()
  const body = trimmed.substring(endIndex + 3).trim()

  const frontmatter: Frontmatter = {}
  let currentKey = ''
  let currentArray: string[] | null = null

  for (const line of yamlBlock.split('\n')) {
    const trimLine = line.trim()
    if (!trimLine) continue

    if (trimLine.startsWith('- ') && currentKey) {
      if (!currentArray) currentArray = []
      currentArray.push(trimLine.substring(2).trim())
      continue
    }

    if (currentArray && currentKey) {
      frontmatter[currentKey] = currentArray
      currentArray = null
    }

    const colonIdx = trimLine.indexOf(':')
    if (colonIdx > 0) {
      currentKey = trimLine.substring(0, colonIdx).trim()
      const value = trimLine.substring(colonIdx + 1).trim()
      if (value) {
        frontmatter[currentKey] = value.replace(/^["']|["']$/g, '')
      }
    }
  }

  if (currentArray && currentKey) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, body }
}

function extractNameFromUrl(url?: string): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop()
    if (filename) {
      return filename.replace(/\.(md|markdown|txt)$/i, '').toLowerCase()
    }
  } catch {
    // ignore
  }
  return null
}
