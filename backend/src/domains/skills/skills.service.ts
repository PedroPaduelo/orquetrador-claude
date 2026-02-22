import { skillsRepository } from './skills.repository.js'
import { parseFrontmatter } from '../../lib/frontmatter.js'
import { fetchMarkdownFromUrl, extractNameFromUrl, fetchJson, fetchText, rawGitHubUrl, toJsonArray } from '../../lib/github.js'

interface GitHubTreeItem {
  path: string
  type: string
}

export const skillsService = {
  async importFromUrl(url: string, isGlobal: boolean) {
    const markdown = await fetchMarkdownFromUrl(url)
    return skillsService.importFromContent(markdown, isGlobal, url)
  },

  async importFromContent(markdown: string, isGlobal: boolean, url?: string) {
    const { frontmatter, body } = parseFrontmatter(markdown)

    const name = (frontmatter.name as string) || extractNameFromUrl(url) || `skill-${Date.now()}`
    const description = (frontmatter.description as string) || null
    const allowedTools = frontmatter['allowed-tools'] || frontmatter.allowedTools || []
    const model = (frontmatter.model as string) || null

    const existing = await skillsRepository.findByName(name)
    if (existing) {
      throw new Error(`Skill com nome "${name}" ja existe`)
    }

    return skillsRepository.create({
      name,
      description,
      body,
      allowedTools: Array.isArray(allowedTools) ? allowedTools : [],
      model: typeof model === 'string' ? model : null,
      frontmatter: JSON.stringify(frontmatter),
      enabled: true,
      isGlobal,
    })
  },

  async resync(id: string) {
    const skill = await skillsRepository.findById(id)
    if (!skill) return null

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
        const content = await fetchText(rawGitHubUrl(repoOwner, repoName, branch, file.path))
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
    const updateData: Parameters<typeof skillsRepository.update>[1] = {
      fileManifest: JSON.stringify(manifest),
      lastSyncedAt: now,
    }

    if (skillMdContent) {
      const { frontmatter, body } = parseFrontmatter(skillMdContent)
      updateData.body = body
      updateData.frontmatter = JSON.stringify(frontmatter)
      const toolsVal = frontmatter['allowed-tools'] || frontmatter.allowedTools
      updateData.allowedTools = JSON.parse(toJsonArray(toolsVal))
      if (frontmatter.description) updateData.description = frontmatter.description as string
    }

    await skillsRepository.update(id, updateData)

    return {
      id: skill.id,
      name: skill.name,
      filesUpdated,
      lastSyncedAt: now.toISOString(),
    }
  },
}
