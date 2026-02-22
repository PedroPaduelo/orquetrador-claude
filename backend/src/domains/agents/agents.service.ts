import { agentsRepository } from './agents.repository.js'
import { parseFrontmatter } from '../../lib/frontmatter.js'
import { fetchMarkdownFromUrl, extractNameFromUrl, fetchText, rawGitHubUrl, toJsonArray } from '../../lib/github.js'

export const agentsService = {
  async importFromUrl(url: string, isGlobal: boolean) {
    const markdown = await fetchMarkdownFromUrl(url)
    return agentsService.importFromContent(markdown, isGlobal, url)
  },

  async importFromContent(markdown: string, isGlobal: boolean, url?: string) {
    const { frontmatter, body } = parseFrontmatter(markdown)

    const name = frontmatter.name as string || extractNameFromUrl(url) || `agent-${Date.now()}`
    const description = (frontmatter.description as string) || null
    const model = (frontmatter.model as string) || null
    const permissionMode = (frontmatter['permission-mode'] as string) || (frontmatter.permissionMode as string) || 'default'
    const maxTurns = frontmatter['max-turns'] || frontmatter.maxTurns
    const tools = frontmatter.tools || []
    const disallowedTools = frontmatter['disallowed-tools'] || frontmatter.disallowedTools || []
    const skills = frontmatter.skills || []

    const existing = await agentsRepository.findByName(name)
    if (existing) {
      throw new Error(`Agent com nome "${name}" ja existe`)
    }

    return agentsRepository.create({
      name,
      description,
      systemPrompt: body,
      tools: Array.isArray(tools) ? tools : [],
      disallowedTools: Array.isArray(disallowedTools) ? disallowedTools : [],
      model: typeof model === 'string' ? model : null,
      permissionMode,
      maxTurns: maxTurns ? parseInt(String(maxTurns), 10) || null : null,
      skills: Array.isArray(skills) ? skills : [],
      enabled: true,
      isGlobal,
    })
  },

  async resync(id: string) {
    const agent = await agentsRepository.findById(id)
    if (!agent) return null

    if (agent.source !== 'imported' || !agent.repoOwner || !agent.repoName || !agent.repoPath) {
      throw new Error('Agent nao foi importado do GitHub ou faltam dados de origem')
    }

    const { repoOwner, repoName, repoBranch, repoPath } = agent
    const branch = repoBranch || 'main'

    const content = await fetchText(rawGitHubUrl(repoOwner, repoName, branch, repoPath))
    const { frontmatter, body } = parseFrontmatter(content)
    const now = new Date()

    await agentsRepository.update(id, {
      description: (frontmatter.description as string) || agent.description,
      systemPrompt: body,
      tools: JSON.parse(toJsonArray(frontmatter.tools)),
      disallowedTools: JSON.parse(toJsonArray(frontmatter.disallowedTools || frontmatter['disallowed-tools'])),
      model: (frontmatter.model as string) || null,
      permissionMode: (frontmatter.permissionMode as string) || (frontmatter['permission-mode'] as string) || 'default',
      maxTurns: frontmatter.maxTurns ? parseInt(String(frontmatter.maxTurns), 10) || null : null,
      skills: JSON.parse(toJsonArray(frontmatter.skills)),
      lastSyncedAt: now,
    })

    return {
      id: agent.id,
      name: agent.name,
      lastSyncedAt: now.toISOString(),
    }
  },
}
