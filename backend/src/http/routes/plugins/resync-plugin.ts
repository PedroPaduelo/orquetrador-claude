import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { prisma } from '../../../lib/prisma.js'
import { NotFoundError } from '../_errors/index.js'

interface GitHubTreeItem {
  path: string
  type: string
}

export async function resyncPlugin(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/plugins/:id/resync',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Re-sync an imported plugin from its original repo',
        params: z.object({ id: z.string() }),
        body: z.object({
          projectPath: z.string().optional(),
        }).default({}),
        response: {
          200: z.object({
            filesUpdated: z.number(),
            skillsFound: z.number(),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params
      const { projectPath: overridePath } = request.body

      const plugin = await prisma.plugin.findUnique({ where: { id } })
      if (!plugin) throw new NotFoundError('Plugin not found')
      if (!plugin.repoUrl) throw new Error('Plugin nao tem repoUrl — nao pode re-sincronizar')

      const projPath = overridePath || plugin.projectPath
      if (!projPath) throw new Error('Informe o projectPath ou atualize no plugin')

      // Parse the repo URL
      const match = plugin.repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/?$)/)
      if (!match) throw new Error('repoUrl invalida')

      const owner = match[1]
      const repo = match[2]
      const branch = 'main'

      // Fetch tree
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      let tree: GitHubTreeItem[]
      try {
        const response = await fetch(treeUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Execut-Orchestrator' },
        })
        if (!response.ok) throw new Error(`GitHub: ${response.status}`)
        const data = await response.json() as { tree: GitHubTreeItem[] }
        tree = data.tree.filter((i) => i.type === 'blob')
      } finally {
        clearTimeout(timeout)
      }

      // Find skills and all their files
      let filesUpdated = 0
      let skillsFound = 0

      for (const file of tree) {
        const filename = file.path.split('/').pop()?.toLowerCase()
        if (filename === 'skill.md') {
          skillsFound++
          const dir = file.path.substring(0, file.path.lastIndexOf('/'))
          const skillName = dir.split('/').pop() || 'unnamed'
          const skillFiles = tree.filter((f) => f.path.startsWith(dir + '/'))

          for (const sf of skillFiles) {
            try {
              const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sf.path}`
              const ctrl = new AbortController()
              const to = setTimeout(() => ctrl.abort(), 15000)
              const resp = await fetch(rawUrl, { signal: ctrl.signal })
              clearTimeout(to)
              if (!resp.ok) continue
              const content = await resp.text()

              const relativePath = sf.path.substring(dir.length + 1)
              const targetPath = join(projPath, '.claude', 'skills', skillName, relativePath)
              mkdirSync(dirname(targetPath), { recursive: true })
              writeFileSync(targetPath, content, 'utf-8')
              filesUpdated++
            } catch { /* skip */ }
          }
        }
      }

      // Also re-download .mcp.json if it exists
      const mcpFile = tree.find((f) => f.path === '.mcp.json')
      if (mcpFile) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.mcp.json`
          const ctrl = new AbortController()
          const to = setTimeout(() => ctrl.abort(), 15000)
          const resp = await fetch(rawUrl, { signal: ctrl.signal })
          clearTimeout(to)
          if (resp.ok) {
            writeFileSync(join(projPath, '.mcp.json'), await resp.text(), 'utf-8')
            filesUpdated++
          }
        } catch { /* skip */ }
      }

      // Update projectPath if changed
      if (overridePath && overridePath !== plugin.projectPath) {
        await prisma.plugin.update({ where: { id }, data: { projectPath: overridePath } })
      }

      return { filesUpdated, skillsFound }
    }
  )
}
