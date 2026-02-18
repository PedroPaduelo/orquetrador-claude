import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { prisma } from '../../lib/prisma.js'

interface GitHubTreeItem {
  path: string
  type: string // 'blob' | 'tree'
}

interface DiscoveredItem {
  type: 'skill' | 'agent' | 'rule'
  name: string
  dir: string // relative dir in repo
  files: string[] // all file paths belonging to this item
}

export async function importRepo(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/import-repo',
    {
      schema: {
        tags: ['Import'],
        summary: 'Scan a GitHub repo and bulk-import skills, agents, and rules into project',
        body: z.object({
          url: z.string().min(1),
          projectPath: z.string().min(1),
          saveToDb: z.boolean().default(true),
        }),
        response: {
          200: z.object({
            imported: z.array(z.object({
              type: z.string(),
              name: z.string(),
              filesCount: z.number(),
            })),
            skipped: z.array(z.object({
              type: z.string(),
              name: z.string(),
              reason: z.string(),
            })),
            errors: z.array(z.object({
              path: z.string(),
              error: z.string(),
            })),
          }),
        },
      },
    },
    async (request) => {
      const { url, projectPath, saveToDb } = request.body

      // Parse GitHub URL (repo, tree, or blob)
      const parsed = parseGitHubUrl(url)
      if (!parsed) {
        throw new Error('URL invalida. Use uma URL do GitHub (ex: https://github.com/user/repo, .../tree/main/path, ou .../blob/main/file.md)')
      }

      const { owner, repo, branch, subpath, isFile } = parsed

      // If it's a single file URL (blob), import just that file directly
      if (isFile && subpath) {
        const result = await importSingleFile(owner, repo, branch, subpath, projectPath, saveToDb)
        return result
      }

      // Get repo tree via GitHub API
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)

      if (!treeResponse?.tree) {
        throw new Error('Nao foi possivel listar arquivos do repositorio. Verifique se o repo e publico.')
      }

      // Filter files within subpath
      const allFiles = treeResponse.tree
        .filter((item) => item.type === 'blob')
        .filter((item) => !subpath || item.path.startsWith(subpath))

      // Discover items: skills (SKILL.md), agents (agent.md in agents/ or *.md with agent frontmatter), rules
      const discovered = discoverItems(allFiles, subpath)

      if (discovered.length === 0) {
        throw new Error(`Nenhum skill, agent ou rule encontrado${subpath ? ` em ${subpath}` : ''}. Encontrados ${allFiles.length} arquivos.`)
      }

      const imported: Array<{ type: string; name: string; filesCount: number }> = []
      const skipped: Array<{ type: string; name: string; reason: string }> = []
      const errors: Array<{ path: string; error: string }> = []

      for (const item of discovered) {
        try {
          // Determine target directory
          let targetDir: string
          if (item.type === 'skill') {
            targetDir = join(projectPath, '.claude', 'skills', item.name)
          } else if (item.type === 'agent') {
            targetDir = join(projectPath, '.claude', 'agents')
          } else {
            // rule
            targetDir = join(projectPath, '.claude', 'rules')
          }

          // Fetch and write all files for this item
          let filesWritten = 0
          for (const filePath of item.files) {
            try {
              const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
              const content = await fetchText(rawUrl)

              // Calculate relative path within the item's directory
              let relativePath: string
              if (item.type === 'skill') {
                // Preserve full subfolder structure: rules/foo.md, scripts/bar.sh, etc.
                relativePath = filePath.substring(item.dir.length + 1)
              } else if (item.type === 'agent') {
                // Agent is a single file
                relativePath = `${item.name}.md`
              } else {
                // Rule - just the filename
                relativePath = filePath.split('/').pop() || filePath
              }

              const targetPath = join(targetDir, relativePath)
              mkdirSync(dirname(targetPath), { recursive: true })
              writeFileSync(targetPath, content, 'utf-8')
              filesWritten++
            } catch (err) {
              errors.push({
                path: filePath,
                error: err instanceof Error ? err.message : 'Erro ao baixar arquivo',
              })
            }
          }

          if (filesWritten > 0) {
            imported.push({
              type: item.type,
              name: item.name,
              filesCount: filesWritten,
            })

            // Also save to DB for UI management if requested
            if (saveToDb) {
              await saveItemToDb(item, owner, repo, branch, projectPath)
            }
          }
        } catch (err) {
          errors.push({
            path: item.dir,
            error: err instanceof Error ? err.message : 'Erro desconhecido',
          })
        }
      }

      return { imported, skipped, errors }
    }
  )
}

/**
 * Scan the file tree and discover skills, agents, and rules.
 */
function discoverItems(files: GitHubTreeItem[], subpath: string): DiscoveredItem[] {
  const items: DiscoveredItem[] = []
  const processedDirs = new Set<string>()

  for (const file of files) {
    const filename = file.path.split('/').pop()?.toLowerCase() || ''
    const dir = file.path.substring(0, file.path.lastIndexOf('/'))

    // --- SKILL: any directory containing SKILL.md ---
    if (filename === 'skill.md') {
      if (processedDirs.has(dir)) continue
      processedDirs.add(dir)

      const skillName = dir.split('/').pop() || 'unnamed-skill'

      // Gather ALL files in this skill directory (recursively)
      const skillFiles = files
        .filter((f) => f.path.startsWith(dir + '/'))
        .map((f) => f.path)

      items.push({
        type: 'skill',
        name: skillName,
        dir,
        files: skillFiles,
      })
    }

    // --- AGENT: .md files inside any 'agents/' directory ---
    if (filename.endsWith('.md') && isInsideAgentsDir(file.path, subpath)) {
      const agentName = filename.replace(/\.md$/i, '')
      if (agentName === 'readme' || agentName === 'agents') continue

      items.push({
        type: 'agent',
        name: agentName,
        dir,
        files: [file.path],
      })
    }

    // --- RULE: .md files inside any 'rules/' directory (that are NOT inside a skill folder) ---
    if (filename.endsWith('.md') && isInsideRulesDir(file.path, subpath)) {
      // Skip if this rules/ is part of a skill (has a sibling SKILL.md up the tree)
      if (isRuleInsideSkill(file.path, files)) continue
      if (filename.startsWith('_') || filename === 'readme.md') continue

      const ruleName = filename.replace(/\.md$/i, '')
      items.push({
        type: 'rule',
        name: ruleName,
        dir,
        files: [file.path],
      })
    }
  }

  return items
}

function isInsideAgentsDir(path: string, _subpath: string): boolean {
  const parts = path.toLowerCase().split('/')
  return parts.includes('agents')
}

function isInsideRulesDir(path: string, _subpath: string): boolean {
  const parts = path.toLowerCase().split('/')
  return parts.includes('rules')
}

function isRuleInsideSkill(rulePath: string, allFiles: GitHubTreeItem[]): boolean {
  // Walk up from the rules/ dir and check if any parent dir has SKILL.md
  const parts = rulePath.split('/')
  const rulesIdx = parts.findIndex((p) => p.toLowerCase() === 'rules')
  if (rulesIdx <= 0) return false

  // Check the parent directory of rules/
  const parentDir = parts.slice(0, rulesIdx).join('/')
  return allFiles.some((f) => f.path === `${parentDir}/SKILL.md`)
}

/**
 * Save discovered item to database for UI management.
 */
async function saveItemToDb(item: DiscoveredItem, owner: string, repo: string, branch: string, projPath: string): Promise<void> {
  const repoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${item.dir}`

  try {
    if (item.type === 'skill') {
      const existing = await prisma.skill.findUnique({ where: { name: item.name } })
      if (existing) return

      const skillMdPath = item.files.find((f) => f.toLowerCase().endsWith('skill.md'))
      if (!skillMdPath) return

      const content = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillMdPath}`)
      const { frontmatter, body } = parseFrontmatter(content)

      await prisma.skill.create({
        data: {
          name: item.name,
          description: (frontmatter.description as string) || `${item.files.length} arquivos de ${owner}/${repo}`,
          body,
          allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
          model: (frontmatter.model as string) || null,
          frontmatter: JSON.stringify(frontmatter),
          enabled: true,
          isGlobal: false,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
        },
      })
    } else if (item.type === 'agent') {
      const existing = await prisma.agent.findUnique({ where: { name: item.name } })
      if (existing) return

      const content = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.files[0]}`)
      const { frontmatter, body } = parseFrontmatter(content)

      await prisma.agent.create({
        data: {
          name: item.name,
          description: (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
          systemPrompt: body,
          tools: toJsonArray(frontmatter.tools),
          disallowedTools: toJsonArray(frontmatter.disallowedTools || frontmatter['disallowed-tools']),
          model: (frontmatter.model as string) || null,
          permissionMode: (frontmatter.permissionMode as string) || (frontmatter['permission-mode'] as string) || 'default',
          maxTurns: frontmatter.maxTurns ? parseInt(String(frontmatter.maxTurns), 10) || null : null,
          skills: toJsonArray(frontmatter.skills),
          enabled: true,
          isGlobal: false,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
        },
      })
    }
    // Rules are file-only, no DB entry needed
  } catch {
    // Non-fatal: DB save is optional
  }
}

// ---- Helpers ----

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; subpath: string; isFile: boolean } | null {
  // Blob URL (single file): github.com/user/repo/blob/branch/path/to/file.md
  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\/?$)/)
  if (blobMatch) {
    return { owner: blobMatch[1], repo: blobMatch[2], branch: blobMatch[3], subpath: blobMatch[4], isFile: true }
  }

  // Tree URL (directory): github.com/user/repo/tree/branch/path
  const treeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+?))?(?:\/?$)/)
  if (treeMatch) {
    return { owner: treeMatch[1], repo: treeMatch[2], branch: treeMatch[3], subpath: treeMatch[4] || '', isFile: false }
  }

  // Repo root: github.com/user/repo
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/?$)/)
  if (repoMatch) {
    return { owner: repoMatch[1], repo: repoMatch[2], branch: 'main', subpath: '', isFile: false }
  }

  return null
}

/**
 * Import a single file (skill SKILL.md or agent .md) from a blob URL.
 */
async function importSingleFile(
  owner: string, repo: string, branch: string, filePath: string,
  projectPath: string, saveToDb: boolean
) {
  const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
  const content = await fetchText(rawFileUrl)

  if (content.trimStart().startsWith('<!')) {
    throw new Error('URL retornou HTML. Verifique se o arquivo e publico.')
  }

  const filename = filePath.split('/').pop()?.toLowerCase() || ''
  const { frontmatter, body } = parseFrontmatter(content)

  const imported: Array<{ type: string; name: string; filesCount: number }> = []
  const errors: Array<{ path: string; error: string }> = []

  // Determine type by filename
  if (filename === 'skill.md') {
    // It's a skill — get parent folder name
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const skillName = (frontmatter.name as string) || dir.split('/').pop() || 'unnamed-skill'

    // Also fetch all sibling files in same directory via tree API
    if (projectPath) {
      try {
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)
        const siblingFiles = (treeResponse?.tree || [])
          .filter((f) => f.type === 'blob' && f.path.startsWith(dir + '/'))

        for (const sf of siblingFiles) {
          try {
            const sfContent = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sf.path}`)
            const relativePath = sf.path.substring(dir.length + 1)
            const targetPath = join(projectPath, '.claude', 'skills', skillName, relativePath)
            mkdirSync(dirname(targetPath), { recursive: true })
            writeFileSync(targetPath, sfContent, 'utf-8')
          } catch { /* skip */ }
        }
        imported.push({ type: 'skill', name: skillName, filesCount: siblingFiles.length })
      } catch {
        // Fallback: write just the SKILL.md
        const targetPath = join(projectPath, '.claude', 'skills', skillName, 'SKILL.md')
        mkdirSync(dirname(targetPath), { recursive: true })
        writeFileSync(targetPath, content, 'utf-8')
        imported.push({ type: 'skill', name: skillName, filesCount: 1 })
      }
    }

    if (saveToDb) {
      try {
        const existing = await prisma.skill.findUnique({ where: { name: skillName } })
        if (!existing) {
          await prisma.skill.create({
            data: {
              name: skillName,
              description: (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
              body,
              allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
              model: (frontmatter.model as string) || null,
              frontmatter: JSON.stringify(frontmatter),
              enabled: true,
              isGlobal: false,
              source: 'imported',
              repoUrl: `https://github.com/${owner}/${repo}/tree/${branch}/${dir}`,
              projectPath,
            },
          })
        }
      } catch { /* non-fatal */ }
    }
  } else if (filename.endsWith('.md')) {
    // It's an agent .md file
    const agentName = (frontmatter.name as string) || filename.replace(/\.md$/i, '')

    if (projectPath) {
      const targetPath = join(projectPath, '.claude', 'agents', `${agentName}.md`)
      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, content, 'utf-8')
      imported.push({ type: 'agent', name: agentName, filesCount: 1 })
    }

    if (saveToDb) {
      try {
        const existing = await prisma.agent.findUnique({ where: { name: agentName } })
        if (!existing) {
          await prisma.agent.create({
            data: {
              name: agentName,
              description: (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
              systemPrompt: body,
              tools: toJsonArray(frontmatter.tools),
              disallowedTools: toJsonArray(frontmatter.disallowedTools || frontmatter['disallowed-tools']),
              model: (frontmatter.model as string) || null,
              permissionMode: (frontmatter.permissionMode as string) || (frontmatter['permission-mode'] as string) || 'default',
              maxTurns: frontmatter.maxTurns ? parseInt(String(frontmatter.maxTurns), 10) || null : null,
              skills: toJsonArray(frontmatter.skills),
              enabled: true,
              isGlobal: false,
              source: 'imported',
              repoUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
              projectPath,
            },
          })
        }
      } catch { /* non-fatal */ }
    }
  } else {
    errors.push({ path: filePath, error: 'Tipo de arquivo nao reconhecido (esperava .md)' })
  }

  return { imported, skipped: [], errors }
}

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

/**
 * Convert a frontmatter value to a JSON array string.
 * Handles: string[] (already array), comma-separated string, or fallback to [].
 */
function toJsonArray(val: unknown): string {
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string' && val.trim()) {
    // "Read, Write, Bash" → ["Read","Write","Bash"]
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
