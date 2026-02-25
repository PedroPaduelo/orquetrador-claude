/**
 * Convert GitHub/GitLab page URLs to raw content URLs.
 *
 * GitHub:  https://github.com/user/repo/blob/branch/path → https://raw.githubusercontent.com/user/repo/branch/path
 * GitLab:  https://gitlab.com/user/repo/-/blob/branch/path → https://gitlab.com/user/repo/-/raw/branch/path
 */
export function toRawUrl(url: string): string {
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

/**
 * Extract a name from a URL path.
 * For skill URLs, tries to extract the skill folder name.
 * e.g. /vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md → web-design-guidelines
 */
export function extractNameFromUrl(url?: string): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
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
 * Fetch markdown content from a URL, auto-converting GitHub/GitLab blob URLs to raw.
 * Throws if the response is HTML or fails.
 */
export async function fetchMarkdownFromUrl(url: string, token?: string | null): Promise<string> {
  const fetchUrl = toRawUrl(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(fetchUrl, { signal: controller.signal, headers })
    if (!response.ok) {
      throw new Error(`Erro ao buscar URL: ${response.status} ${response.statusText}`)
    }
    const text = await response.text()
    if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
      throw new Error('A URL retornou HTML ao inves de markdown. Use a URL raw do arquivo (ex: raw.githubusercontent.com).')
    }
    return text
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch JSON from a URL (with GitHub API headers).
 * Accepts optional token for authenticated requests (higher rate limits + private repos).
 */
export async function fetchJson<T>(url: string, token?: string | null): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Execut-Orchestrator',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    })
    if (!response.ok) throw new Error(`GitHub API: ${response.status} ${response.statusText}`)
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch raw text from a URL.
 */
export async function fetchText(url: string, token?: string | null): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(url, { signal: controller.signal, headers })
    if (!response.ok) throw new Error(`Fetch: ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Build a raw.githubusercontent.com URL from parts.
 */
export function rawGitHubUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

/**
 * Convert a frontmatter value to a JSON array string for DB storage.
 * Handles: string[] (already array), comma-separated string, or fallback to [].
 */
export function toJsonArray(val: unknown): string {
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string' && val.trim()) {
    return JSON.stringify(val.split(',').map((s) => s.trim()).filter(Boolean))
  }
  return '[]'
}
