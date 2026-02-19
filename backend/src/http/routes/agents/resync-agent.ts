import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function resyncAgent(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/agents/:id/resync',
    {
      schema: {
        tags: ['Agents'],
        summary: 'Re-sync an imported agent from its GitHub source',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            lastSyncedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const agent = await prisma.agent.findUnique({ where: { id } })
      if (!agent) throw new NotFoundError('Agent not found')

      if (agent.source !== 'imported' || !agent.repoOwner || !agent.repoName || !agent.repoPath) {
        throw new Error('Agent nao foi importado do GitHub ou faltam dados de origem')
      }

      const { repoOwner, repoName, repoBranch, repoPath } = agent
      const branch = repoBranch || 'main'

      // Fetch the agent file
      const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/${repoPath}`
      const content = await fetchText(rawUrl)
      const { frontmatter, body } = parseFrontmatter(content)
      const now = new Date()

      await prisma.agent.update({
        where: { id },
        data: {
          description: (frontmatter.description as string) || agent.description,
          systemPrompt: body,
          tools: toJsonArray(frontmatter.tools),
          disallowedTools: toJsonArray(frontmatter.disallowedTools || frontmatter['disallowed-tools']),
          model: (frontmatter.model as string) || null,
          permissionMode: (frontmatter.permissionMode as string) || (frontmatter['permission-mode'] as string) || 'default',
          maxTurns: frontmatter.maxTurns ? parseInt(String(frontmatter.maxTurns), 10) || null : null,
          skills: toJsonArray(frontmatter.skills),
          lastSyncedAt: now,
        },
      })

      return {
        id: agent.id,
        name: agent.name,
        lastSyncedAt: now.toISOString(),
      }
    }
  )
}

// ---- Helpers ----

interface Frontmatter { [key: string]: unknown }

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = markdown.trim()
  if (!trimmed.startsWith('---')) return { frontmatter: {}, body: trimmed }
  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) return { frontmatter: {}, body: trimmed }

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
      if (value) frontmatter[currentKey] = value.replace(/^["']|["']$/g, '')
    }
  }
  if (currentArray && currentKey) frontmatter[currentKey] = currentArray
  return { frontmatter, body }
}

function toJsonArray(val: unknown): string {
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string' && val.trim()) {
    return JSON.stringify(val.split(',').map((s) => s.trim()).filter(Boolean))
  }
  return '[]'
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Fetch: ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}
