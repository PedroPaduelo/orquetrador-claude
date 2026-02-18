import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function importSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/skills/import',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Import a skill from a URL (raw SKILL.md) or pasted markdown content',
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
        // Auto-convert GitHub page URLs to raw URLs
        const fetchUrl = toRawUrl(url)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        try {
          const response = await fetch(fetchUrl, { signal: controller.signal })
          if (!response.ok) {
            throw new Error(`Erro ao buscar URL: ${response.status} ${response.statusText}`)
          }
          markdown = await response.text()

          // Safety check: if we got HTML back, the URL was wrong
          if (markdown.trimStart().startsWith('<!') || markdown.trimStart().startsWith('<html')) {
            throw new Error('A URL retornou HTML ao inves de markdown. Use a URL raw do arquivo (ex: raw.githubusercontent.com).')
          }
        } finally {
          clearTimeout(timeout)
        }
      } else {
        markdown = rawContent!
      }

      // Parse frontmatter
      const { frontmatter, body } = parseFrontmatter(markdown)

      const name = (frontmatter.name as string) || extractNameFromUrl(url) || `skill-${Date.now()}`
      const description = (frontmatter.description as string) || null
      const allowedTools = frontmatter['allowed-tools'] || frontmatter.allowedTools || []
      const model = (frontmatter.model as string) || null

      // Check for name uniqueness
      const existing = await prisma.skill.findUnique({ where: { name } })
      if (existing) {
        throw new Error(`Skill com nome "${name}" ja existe`)
      }

      const skill = await prisma.skill.create({
        data: {
          name,
          description,
          body,
          allowedTools: JSON.stringify(Array.isArray(allowedTools) ? allowedTools : []),
          model: typeof model === 'string' ? model : null,
          frontmatter: JSON.stringify(frontmatter),
          enabled: true,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        createdAt: skill.createdAt.toISOString(),
      })
    }
  )
}

interface Frontmatter {
  [key: string]: unknown
}

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Supports simple key: value, arrays with - item, and nested values.
 */
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

    // Array item: "  - value"
    if (trimLine.startsWith('- ') && currentKey) {
      if (!currentArray) currentArray = []
      currentArray.push(trimLine.substring(2).trim())
      continue
    }

    // If we were building an array, save it
    if (currentArray && currentKey) {
      frontmatter[currentKey] = currentArray
      currentArray = null
    }

    // Key: value pair
    const colonIdx = trimLine.indexOf(':')
    if (colonIdx > 0) {
      currentKey = trimLine.substring(0, colonIdx).trim()
      const value = trimLine.substring(colonIdx + 1).trim()
      if (value) {
        // Remove quotes
        frontmatter[currentKey] = value.replace(/^["']|["']$/g, '')
      }
      // If value is empty, might be an array starting next line
    }
  }

  // Save last array if any
  if (currentArray && currentKey) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, body }
}

function extractNameFromUrl(url?: string): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
    // For skill URLs, try to extract the skill folder name
    // e.g. /vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md → web-design-guidelines
    const parts = pathname.split('/')
    const mdIndex = parts.findIndex((p) => /\.(md|markdown)$/i.test(p))
    if (mdIndex > 0) {
      return parts[mdIndex - 1].toLowerCase()
    }
    const filename = parts.pop()
    if (filename) {
      return filename.replace(/\.(md|markdown|txt)$/i, '').toLowerCase()
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Convert GitHub/GitLab page URLs to raw content URLs.
 *
 * GitHub:  https://github.com/user/repo/blob/branch/path → https://raw.githubusercontent.com/user/repo/branch/path
 * GitLab:  https://gitlab.com/user/repo/-/blob/branch/path → https://gitlab.com/user/repo/-/raw/branch/path
 */
function toRawUrl(url: string): string {
  // GitHub: github.com/user/repo/blob/branch/path
  const ghMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (ghMatch) {
    return `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}`
  }

  // GitLab: gitlab.com/user/repo/-/blob/branch/path
  const glMatch = url.match(/^https?:\/\/gitlab\.com\/(.+)\/-\/blob\/(.+)$/)
  if (glMatch) {
    return `https://gitlab.com/${glMatch[1]}/-/raw/${glMatch[2]}`
  }

  // Already a raw URL or other provider
  return url
}
