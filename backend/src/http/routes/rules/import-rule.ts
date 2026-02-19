import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'

export async function importRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/rules/import',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Import a rule from a URL (raw .md) or pasted markdown content',
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
        const fetchUrl = toRawUrl(url)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        try {
          const response = await fetch(fetchUrl, { signal: controller.signal })
          if (!response.ok) {
            throw new Error(`Erro ao buscar URL: ${response.status} ${response.statusText}`)
          }
          markdown = await response.text()

          if (markdown.trimStart().startsWith('<!') || markdown.trimStart().startsWith('<html')) {
            throw new Error('A URL retornou HTML ao inves de markdown. Use a URL raw do arquivo.')
          }
        } finally {
          clearTimeout(timeout)
        }
      } else {
        markdown = rawContent!
      }

      const name = extractNameFromUrl(url) || `rule-${Date.now()}`
      const body = markdown.trim()

      const existing = await prisma.rule.findUnique({ where: { name } })
      if (existing) {
        throw new Error(`Rule com nome "${name}" ja existe`)
      }

      const rule = await prisma.rule.create({
        data: {
          name,
          description: null,
          body,
          enabled: true,
          isGlobal,
        },
      })

      return reply.status(201).send({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        createdAt: rule.createdAt.toISOString(),
      })
    }
  )
}

function extractNameFromUrl(url?: string): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    const filename = parts.pop()
    if (filename) {
      return filename.replace(/\.(md|markdown|txt)$/i, '').toLowerCase()
    }
  } catch {
    // ignore
  }
  return null
}

function toRawUrl(url: string): string {
  const ghMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (ghMatch) {
    return `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}`
  }

  const glMatch = url.match(/^https?:\/\/gitlab\.com\/(.+)\/-\/blob\/(.+)$/)
  if (glMatch) {
    return `https://gitlab.com/${glMatch[1]}/-/raw/${glMatch[2]}`
  }

  return url
}
