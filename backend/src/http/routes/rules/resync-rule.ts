import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

export async function resyncRule(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/rules/:id/resync',
    {
      schema: {
        tags: ['Rules'],
        summary: 'Re-sync an imported rule from its GitHub source',
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

      const rule = await prisma.rule.findUnique({ where: { id } })
      if (!rule) throw new NotFoundError('Rule not found')

      if (rule.source !== 'imported' || !rule.repoOwner || !rule.repoName || !rule.repoPath) {
        throw new Error('Rule nao foi importada do GitHub ou faltam dados de origem')
      }

      const { repoOwner, repoName, repoBranch, repoPath } = rule
      const branch = repoBranch || 'main'

      // Fetch the rule file
      const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/${repoPath}`
      const content = await fetchText(rawUrl)
      const now = new Date()

      await prisma.rule.update({
        where: { id },
        data: {
          body: content,
          lastSyncedAt: now,
        },
      })

      return {
        id: rule.id,
        name: rule.name,
        lastSyncedAt: now.toISOString(),
      }
    }
  )
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
