import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { prisma } from '../../../lib/prisma.js'

interface GitHubTreeItem {
  path: string
  type: string
}

export async function importPluginUrl(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/plugins/import-url',
    {
      schema: {
        tags: ['Plugins'],
        summary: 'Import a plugin from a GitHub repo URL or a direct manifest JSON URL',
        body: z.object({
          url: z.string().min(1),
          projectPath: z.string().optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            mcpServersCount: z.number(),
            skillsCount: z.number(),
            agentsCount: z.number(),
            filesInstalled: z.number(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { url, projectPath } = request.body

      // Detect if this is a GitHub repo URL or a direct file URL
      const repoInfo = parseGitHubRepoUrl(url)

      if (repoInfo) {
        // It's a GitHub repo — scan for plugin.json + skills + agents
        const result = await importFromGitHubRepo(repoInfo, projectPath)
        return reply.status(201).send(result)
      }

      // It's a direct URL to a JSON manifest file
      const fetchUrl = toRawUrl(url)
      const text = await fetchText(fetchUrl)

      if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
        throw new Error('A URL retornou HTML. Cole a URL do repositorio GitHub (ex: https://github.com/user/repo) ou de um arquivo JSON raw.')
      }

      let manifest: PluginManifest
      try {
        manifest = JSON.parse(text)
      } catch {
        throw new Error('O conteudo da URL nao e JSON valido.')
      }

      if (!manifest.name) {
        throw new Error('Manifesto invalido: campo "name" obrigatorio')
      }

      const existing = await prisma.plugin.findUnique({ where: { name: manifest.name } })
      if (existing) {
        throw new Error(`Plugin "${manifest.name}" ja existe`)
      }

      const plugin = await prisma.plugin.create({
        data: {
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author,
          manifest: JSON.stringify(manifest),
          source: 'imported',
          repoUrl: url,
          mcpServers: {
            create: (manifest.mcpServers || []).map((s) => ({
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
            create: (manifest.skills || []).map((s) => ({
              name: s.name,
              description: s.description,
              body: s.body || '',
              allowedTools: JSON.stringify(s.allowedTools || []),
              model: s.model,
              source: 'imported',
              repoUrl: url,
            })),
          },
          agents: {
            create: (manifest.agents || []).map((a) => ({
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt || '',
              tools: JSON.stringify(a.tools || []),
              disallowedTools: JSON.stringify(a.disallowedTools || []),
              model: a.model,
              permissionMode: a.permissionMode || 'default',
              maxTurns: a.maxTurns,
              skills: JSON.stringify(a.skills || []),
              source: 'imported',
              repoUrl: url,
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
        filesInstalled: 0,
        createdAt: plugin.createdAt.toISOString(),
      })
    }
  )
}

// ---- GitHub Repo Import ----

interface RepoInfo {
  owner: string
  repo: string
  branch: string
  subpath: string
}

async function importFromGitHubRepo(info: RepoInfo, projectPath?: string) {
  const { owner, repo, branch } = info

  // Get full tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)
  if (!treeResponse?.tree) {
    throw new Error('Nao foi possivel listar arquivos do repositorio.')
  }

  const allFiles = treeResponse.tree.filter((item) => item.type === 'blob')

  // Try to find plugin.json for metadata
  let pluginMeta: { name: string; description?: string; version?: string; author?: string } | null = null
  const pluginJsonPath = allFiles.find((f) =>
    f.path === '.claude-plugin/plugin.json' || f.path === 'plugin.json'
  )
  if (pluginJsonPath) {
    try {
      const content = await fetchText(rawUrl(owner, repo, branch, pluginJsonPath.path))
      pluginMeta = JSON.parse(content)
    } catch { /* ignore */ }
  }

  const pluginName = pluginMeta?.name || repo
  const pluginDescription = pluginMeta?.description || `Plugin importado de ${owner}/${repo}`

  // Check uniqueness
  const existing = await prisma.plugin.findUnique({ where: { name: pluginName } })
  if (existing) {
    throw new Error(`Plugin "${pluginName}" ja existe`)
  }

  // Find skills (SKILL.md)
  const skillDirs = new Map<string, string[]>() // dir → files
  for (const file of allFiles) {
    const filename = file.path.split('/').pop()?.toLowerCase()
    if (filename === 'skill.md') {
      const dir = file.path.substring(0, file.path.lastIndexOf('/'))
      // Get all files in this skill directory
      const dirFiles = allFiles.filter((f) => f.path.startsWith(dir + '/')).map((f) => f.path)
      skillDirs.set(dir, dirFiles)
    }
  }

  // Find agents (agent.md inside agents/ dir)
  const agentFiles: string[] = []
  for (const file of allFiles) {
    const filename = file.path.split('/').pop()?.toLowerCase() || ''
    if (filename.endsWith('.md') && file.path.toLowerCase().includes('/agents/')) {
      if (filename !== 'readme.md') agentFiles.push(file.path)
    }
  }

  // Find .mcp.json
  const mcpJsonFile = allFiles.find((f) => f.path === '.mcp.json')

  // Install files to projectPath if provided
  let filesInstalled = 0
  if (projectPath) {
    // Install skills
    for (const [dir, files] of skillDirs) {
      const skillName = dir.split('/').pop() || 'unnamed'
      for (const filePath of files) {
        try {
          const content = await fetchText(rawUrl(owner, repo, branch, filePath))
          const relativePath = filePath.substring(dir.length + 1)
          const targetPath = join(projectPath, '.claude', 'skills', skillName, relativePath)
          mkdirSync(dirname(targetPath), { recursive: true })
          writeFileSync(targetPath, content, 'utf-8')
          filesInstalled++
        } catch { /* skip */ }
      }
    }

    // Install agents
    for (const agentPath of agentFiles) {
      try {
        const content = await fetchText(rawUrl(owner, repo, branch, agentPath))
        const filename = agentPath.split('/').pop() || 'agent.md'
        const targetPath = join(projectPath, '.claude', 'agents', filename)
        mkdirSync(dirname(targetPath), { recursive: true })
        writeFileSync(targetPath, content, 'utf-8')
        filesInstalled++
      } catch { /* skip */ }
    }

    // Install .mcp.json (merge if exists)
    if (mcpJsonFile) {
      try {
        const content = await fetchText(rawUrl(owner, repo, branch, mcpJsonFile.path))
        const targetPath = join(projectPath, '.mcp.json')
        writeFileSync(targetPath, content, 'utf-8')
        filesInstalled++
      } catch { /* skip */ }
    }
  }

  // Save to DB
  const skillRecords: Array<{ name: string; description: string }> = []
  for (const [dir] of skillDirs) {
    const skillName = dir.split('/').pop() || 'unnamed'
    try {
      const skillMdPath = allFiles.find((f) => f.path === `${dir}/SKILL.md`)
      let description = `Skill de ${owner}/${repo}`
      if (skillMdPath) {
        const content = await fetchText(rawUrl(owner, repo, branch, skillMdPath.path))
        const { frontmatter } = parseFrontmatter(content)
        description = (frontmatter.description as string) || description
      }
      skillRecords.push({ name: skillName, description })
    } catch {
      skillRecords.push({ name: skillName, description: `Skill de ${owner}/${repo}` })
    }
  }

  const plugin = await prisma.plugin.create({
    data: {
      name: pluginName,
      description: pluginDescription,
      version: typeof pluginMeta?.version === 'string' ? pluginMeta.version : null,
      author: typeof pluginMeta?.author === 'string' ? pluginMeta.author : typeof pluginMeta?.author === 'object' && pluginMeta.author !== null ? (pluginMeta.author as Record<string, string>).name || JSON.stringify(pluginMeta.author) : null,
      manifest: JSON.stringify(pluginMeta || {}),
      source: 'imported',
      repoUrl: `https://github.com/${owner}/${repo}`,
      projectPath,
      skills: {
        create: skillRecords.map((s) => ({
          name: s.name,
          description: s.description,
          source: 'imported',
          repoUrl: `https://github.com/${owner}/${repo}`,
          projectPath,
          isGlobal: false,
          enabled: true,
        })),
      },
    },
    include: {
      _count: { select: { mcpServers: true, skills: true, agents: true } },
    },
  })

  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    mcpServersCount: plugin._count.mcpServers,
    skillsCount: plugin._count.skills,
    agentsCount: plugin._count.agents,
    filesInstalled,
    createdAt: plugin.createdAt.toISOString(),
  }
}

// ---- Helpers ----

function rawUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

function parseGitHubRepoUrl(url: string): RepoInfo | null {
  // Match repo URLs (NOT blob/file URLs)
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch/path
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?(?:\/?$)/)
  if (!match) return null
  // Make sure it's NOT a blob URL (those are file URLs, not repo URLs)
  if (url.includes('/blob/')) return null
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || 'main',
    subpath: match[4] || '',
  }
}

function toRawUrl(url: string): string {
  const ghMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (ghMatch) return `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}`
  const glMatch = url.match(/^https?:\/\/gitlab\.com\/(.+)\/-\/blob\/(.+)$/)
  if (glMatch) return `https://gitlab.com/${glMatch[1]}/-/raw/${glMatch[2]}`
  return url
}

interface Frontmatter { [key: string]: unknown }

function parseFrontmatter(md: string): { frontmatter: Frontmatter; body: string } {
  const t = md.trim()
  if (!t.startsWith('---')) return { frontmatter: {}, body: t }
  const end = t.indexOf('---', 3)
  if (end === -1) return { frontmatter: {}, body: t }
  const yaml = t.substring(3, end).trim()
  const body = t.substring(end + 3).trim()
  const fm: Frontmatter = {}
  let key = ''
  let arr: string[] | null = null
  for (const line of yaml.split('\n')) {
    const tl = line.trim()
    if (!tl) continue
    if (tl.startsWith('- ') && key) { if (!arr) arr = []; arr.push(tl.substring(2).trim()); continue }
    if (arr && key) { fm[key] = arr; arr = null }
    const ci = tl.indexOf(':')
    if (ci > 0) { key = tl.substring(0, ci).trim(); const v = tl.substring(ci + 1).trim(); if (v) fm[key] = v.replace(/^["']|["']$/g, '') }
  }
  if (arr && key) fm[key] = arr
  return { frontmatter: fm, body }
}

async function fetchJson<T>(url: string): Promise<T> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 30000)
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Execut-Orchestrator' } })
    if (!r.ok) throw new Error(`GitHub API: ${r.status}`)
    return await r.json() as T
  } finally { clearTimeout(t) }
}

async function fetchText(url: string): Promise<string> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 15000)
  try {
    const r = await fetch(url, { signal: c.signal })
    if (!r.ok) throw new Error(`Fetch: ${r.status}`)
    return await r.text()
  } finally { clearTimeout(t) }
}

interface PluginManifest {
  name: string
  description?: string
  version?: string
  author?: string
  mcpServers?: Array<{ name: string; description?: string; type?: string; uri?: string; command?: string; args?: string[]; envVars?: Record<string, string> }>
  skills?: Array<{ name: string; description?: string; body?: string; allowedTools?: string[]; model?: string }>
  agents?: Array<{ name: string; description?: string; systemPrompt?: string; tools?: string[]; disallowedTools?: string[]; model?: string; permissionMode?: string; maxTurns?: number; skills?: string[] }>
}
