import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

interface GitHubTreeItem {
  path: string
  type: string
}

export async function resyncSkill(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/skills/:id/resync',
    {
      schema: {
        tags: ['Skills'],
        summary: 'Re-sync an imported skill from its GitHub source',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            filesUpdated: z.number(),
            lastSyncedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params

      const skill = await prisma.skill.findUnique({ where: { id } })
      if (!skill) throw new NotFoundError('Skill not found')

      if (skill.source !== 'imported' || !skill.repoOwner || !skill.repoName) {
        throw new Error('Skill nao foi importada do GitHub ou faltam dados de origem')
      }

      const { repoOwner, repoName, repoBranch, repoPath } = skill
      const branch = repoBranch || 'main'

      if (!repoPath) {
        throw new Error('Skill nao tem repoPath — nao pode re-sincronizar')
      }

      // Fetch the tree
      const treeUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`
      const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)

      if (!treeResponse?.tree) {
        throw new Error('Nao foi possivel listar arquivos do repositorio')
      }

      // Find all files in the skill directory
      const skillFiles = treeResponse.tree
        .filter((f) => f.type === 'blob' && f.path.startsWith(repoPath + '/'))

      if (skillFiles.length === 0) {
        throw new Error(`Nenhum arquivo encontrado em ${repoPath}`)
      }

      // Download all files and build manifest
      const manifest: Array<{ path: string; content: string }> = []
      let skillMdContent = ''
      let filesUpdated = 0

      for (const file of skillFiles) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/${file.path}`
          const content = await fetchText(rawUrl)
          const relativePath = file.path.substring(repoPath.length + 1)
          manifest.push({ path: relativePath, content })
          filesUpdated++

          if (relativePath.toLowerCase() === 'skill.md') {
            skillMdContent = content
          }
        } catch { /* skip individual files */ }
      }

      // Parse SKILL.md for DB fields
      const now = new Date()
      const updateData: Record<string, unknown> = {
        fileManifest: JSON.stringify(manifest),
        lastSyncedAt: now,
      }

      if (skillMdContent) {
        const { frontmatter, body } = parseFrontmatter(skillMdContent)
        updateData.body = body
        updateData.frontmatter = JSON.stringify(frontmatter)
        updateData.allowedTools = toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools)
        if (frontmatter.description) updateData.description = frontmatter.description
        if (frontmatter.model) updateData.model = frontmatter.model
      }

      await prisma.skill.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.skill.update>[0]['data'],
      })

      return {
        id: skill.id,
        name: skill.name,
        filesUpdated,
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

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Execut-Orchestrator' },
    })
    if (!response.ok) throw new Error(`GitHub API: ${response.status} ${response.statusText}`)
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
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
