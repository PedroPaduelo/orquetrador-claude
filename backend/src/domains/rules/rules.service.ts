import { rulesRepository } from './rules.repository.js'
import { fetchMarkdownFromUrl, extractNameFromUrl, fetchText, rawGitHubUrl } from '../../lib/github.js'

export const rulesService = {
  async importFromUrl(url: string, isGlobal: boolean, userId?: string) {
    const markdown = await fetchMarkdownFromUrl(url)
    return rulesService.importFromContent(markdown, isGlobal, url, userId)
  },

  async importFromContent(markdown: string, isGlobal: boolean, url?: string, userId?: string) {
    const name = extractNameFromUrl(url) || `rule-${Date.now()}`
    const body = markdown.trim()

    const existing = await rulesRepository.findByName(name, userId)
    if (existing) {
      throw new Error(`Rule com nome "${name}" ja existe`)
    }

    return rulesRepository.create({
      name,
      description: null,
      body,
      enabled: true,
      isGlobal,
    }, userId!)
  },

  async resync(id: string, userId: string) {
    const rule = await rulesRepository.findById(id, userId)
    if (!rule) return null

    if (rule.source !== 'imported' || !rule.repoOwner || !rule.repoName || !rule.repoPath) {
      throw new Error('Rule nao foi importada do GitHub ou faltam dados de origem')
    }

    const { repoOwner, repoName, repoBranch, repoPath } = rule
    const branch = repoBranch || 'main'

    const content = await fetchText(rawGitHubUrl(repoOwner, repoName, branch, repoPath))
    const now = new Date()

    await rulesRepository.update(id, userId, {
      body: content,
      lastSyncedAt: now,
    })

    return {
      id: rule.id,
      name: rule.name,
      lastSyncedAt: now.toISOString(),
    }
  },
}
