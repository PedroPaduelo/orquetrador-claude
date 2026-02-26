import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { pluginsRepository } from './plugins.repository.js'
import { parseFrontmatter } from '../../lib/frontmatter.js'
import { toRawUrl, fetchJson, fetchText, rawGitHubUrl } from '../../lib/github.js'

// ---- Types ----

interface PluginManifest {
  name: string
  description?: string
  version?: string
  author?: string
  mcpServers?: Array<{
    name: string
    description?: string
    type: string
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

interface GitHubTreeItem {
  path: string
  type: string
}

// ---- Helpers ----

function isGitHubRepoUrl(url: string): boolean {
  // Matches https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/...
  // but NOT a direct file blob URL that ends with a known extension
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+(\/|$)/.test(url) &&
    !/\.(json|md|txt|yaml|yml)$/i.test(url.split('?')[0]) &&
    !/\/blob\//.test(url)
}

function parseGitHubRepoUrl(url: string): { owner: string; repo: string; branch: string; subPath: string } {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/)
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`)
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    branch: match[3] || 'main',
    subPath: match[4] || '',
  }
}

function writeFileSafe(filePath: string, content: string) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

// ---- Service ----

export const pluginsService = {
  async install(input: PluginManifest, userId?: string) {
    const existing = await pluginsRepository.findByName(input.name, userId)
    if (existing) {
      throw new Error(`Plugin with name "${input.name}" already exists`)
    }

    return pluginsRepository.create({
      name: input.name,
      description: input.description ?? null,
      version: input.version ?? null,
      author: input.author ?? null,
      manifest: input as object,
      enabled: true,
      source: 'manual',
      mcpServers: input.mcpServers ?? [],
      skills: input.skills ?? [],
      agents: input.agents ?? [],
    }, userId!)
  },

  async importFromUrl(url: string, projectPath?: string, userId?: string) {
    if (isGitHubRepoUrl(url)) {
      return pluginsService._importFromGitHubRepo(url, projectPath, userId)
    }
    // Direct JSON manifest URL
    const rawUrl = toRawUrl(url)
    const manifest = await fetchJson<PluginManifest>(rawUrl)
    return pluginsService.install(manifest, userId)
  },

  async _importFromGitHubRepo(repoUrl: string, projectPath?: string, userId?: string) {
    const { owner, repo, branch, subPath } = parseGitHubRepoUrl(repoUrl)

    // Fetch file tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)

    if (!treeResponse?.tree) {
      throw new Error('Could not list files from repository')
    }

    const tree = treeResponse.tree
    const prefix = subPath ? subPath + '/' : ''

    // Discover .mcp.json server definitions
    const mcpJsonFiles = tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith(prefix) && f.path.endsWith('.mcp.json')
    )

    // Discover skill directories (contain SKILL.md)
    const skillMdPaths = tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith(prefix) && /\/SKILL\.md$/i.test(f.path)
    )

    // Discover agent directories (contain AGENT.md or agent.json)
    const agentPaths = tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith(prefix) && /\/AGENT\.(md|json)$/i.test(f.path)
    )

    // Build plugin name from repo
    const pluginName = subPath ? `${repo}/${subPath}` : repo

    const existing = await pluginsRepository.findByName(pluginName, userId)
    if (existing) {
      throw new Error(`Plugin with name "${pluginName}" already exists`)
    }

    // Parse mcp servers from .mcp.json files
    const mcpServers: PluginManifest['mcpServers'] = []
    for (const f of mcpJsonFiles) {
      try {
        const content = await fetchText(rawGitHubUrl(owner, repo, branch, f.path))
        const parsed = JSON.parse(content)
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          for (const [name, config] of Object.entries(parsed.mcpServers as Record<string, { command?: string; args?: string[]; env?: Record<string, string>; url?: string; type?: string }>)) {
            mcpServers.push({
              name,
              type: config.type || (config.command ? 'stdio' : 'http'),
              command: config.command ?? undefined,
              args: config.args ?? [],
              envVars: config.env ?? {},
              uri: config.url ?? undefined,
            })
          }
        }
      } catch { /* skip unparseable files */ }
    }

    // Parse skills from SKILL.md files
    const skills: PluginManifest['skills'] = []
    const skillFiles: Array<{ path: string; content: string }> = []

    for (const f of skillMdPaths) {
      try {
        const content = await fetchText(rawGitHubUrl(owner, repo, branch, f.path))
        const { frontmatter, body } = parseFrontmatter(content)
        const skillName = (frontmatter.name as string) || f.path.split('/').slice(-2, -1)[0] || `skill-${Date.now()}`
        skills.push({
          name: skillName,
          description: (frontmatter.description as string) ?? undefined,
          body,
          allowedTools: Array.isArray(frontmatter['allowed-tools'] || frontmatter.allowedTools)
            ? (frontmatter['allowed-tools'] || frontmatter.allowedTools) as string[]
            : [],
          model: (frontmatter.model as string) ?? undefined,
        })
        skillFiles.push({ path: f.path, content })

        // Write to projectPath if provided
        if (projectPath) {
          const skillDir = f.path.split('/').slice(-2, -1)[0]
          const localPath = join(projectPath, skillDir, 'SKILL.md')
          writeFileSafe(localPath, content)
        }
      } catch { /* skip */ }
    }

    // Parse agents from AGENT.md files
    const agents: PluginManifest['agents'] = []

    for (const f of agentPaths) {
      try {
        const content = await fetchText(rawGitHubUrl(owner, repo, branch, f.path))
        if (f.path.endsWith('.json')) {
          const parsed = JSON.parse(content)
          agents.push({
            name: parsed.name || f.path.split('/').slice(-2, -1)[0] || `agent-${Date.now()}`,
            description: parsed.description ?? undefined,
            systemPrompt: parsed.systemPrompt ?? '',
            tools: parsed.tools ?? [],
            disallowedTools: parsed.disallowedTools ?? [],
            model: parsed.model ?? undefined,
            permissionMode: parsed.permissionMode ?? 'default',
            maxTurns: parsed.maxTurns ?? undefined,
            skills: parsed.skills ?? [],
          })
        } else {
          // .md agent
          const { frontmatter, body } = parseFrontmatter(content)
          const agentName = (frontmatter.name as string) || f.path.split('/').slice(-2, -1)[0] || `agent-${Date.now()}`
          agents.push({
            name: agentName,
            description: (frontmatter.description as string) ?? undefined,
            systemPrompt: body,
            tools: Array.isArray(frontmatter.tools) ? frontmatter.tools as string[] : [],
            disallowedTools: Array.isArray(frontmatter['disallowed-tools'] || frontmatter.disallowedTools)
              ? (frontmatter['disallowed-tools'] || frontmatter.disallowedTools) as string[]
              : [],
            model: (frontmatter.model as string) ?? undefined,
            permissionMode: (frontmatter['permission-mode'] as string) || (frontmatter.permissionMode as string) || 'default',
            maxTurns: typeof frontmatter['max-turns'] === 'number' ? frontmatter['max-turns'] : undefined,
            skills: Array.isArray(frontmatter.skills) ? frontmatter.skills as string[] : [],
          })
        }
      } catch { /* skip */ }
    }

    return pluginsRepository.create({
      name: pluginName,
      description: null,
      version: null,
      author: owner,
      manifest: { repoUrl, owner, repo, branch, subPath },
      enabled: true,
      source: 'imported',
      repoUrl,
      projectPath: projectPath ?? null,
      mcpServers,
      skills,
      agents,
    }, userId!)
  },

  async resync(id: string, userId: string, overridePath?: string) {
    const plugin = await pluginsRepository.findById(id, userId)
    if (!plugin) return null

    if (plugin.source !== 'imported' || !plugin.repoUrl) {
      throw new Error('Plugin was not imported from a GitHub repo or is missing source data')
    }

    const repoUrl = plugin.repoUrl
    const { owner, repo, branch, subPath } = parseGitHubRepoUrl(repoUrl)
    const effectivePath = overridePath ?? plugin.projectPath ?? undefined

    // Fetch tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)

    if (!treeResponse?.tree) {
      throw new Error('Could not list files from repository')
    }

    const tree = treeResponse.tree
    const prefix = subPath ? subPath + '/' : ''

    // Re-discover and update skill files
    const skillMdPaths = tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith(prefix) && /\/SKILL\.md$/i.test(f.path)
    )

    let filesUpdated = 0

    for (const f of skillMdPaths) {
      try {
        const content = await fetchText(rawGitHubUrl(owner, repo, branch, f.path))
        filesUpdated++

        if (effectivePath) {
          const skillDir = f.path.split('/').slice(-2, -1)[0]
          const localPath = join(effectivePath, skillDir, 'SKILL.md')
          writeFileSafe(localPath, content)
        }
      } catch { /* skip individual files */ }
    }

    // Re-discover and update agent files
    const agentPaths = tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith(prefix) && /\/AGENT\.(md|json)$/i.test(f.path)
    )

    for (const f of agentPaths) {
      try {
        await fetchText(rawGitHubUrl(owner, repo, branch, f.path))
        filesUpdated++
      } catch { /* skip */ }
    }

    const now = new Date()

    // Update plugin metadata (bump updatedAt via projectPath write)
    const updateData: Parameters<typeof pluginsRepository.update>[2] = {}
    if (overridePath) updateData.projectPath = overridePath

    await pluginsRepository.update(id, userId, updateData)

    return {
      id: plugin.id,
      name: plugin.name,
      filesUpdated,
      lastSyncedAt: now.toISOString(),
    }
  },
}
