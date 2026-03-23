import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { parseFrontmatter } from '../../lib/frontmatter.js'
import { fetchJson, fetchText, toJsonArray } from '../../lib/github.js'
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

type ImportResult = {
  imported: Array<{ type: string; name: string; filesCount: number }>
  skipped: Array<{ type: string; name: string; reason: string }>
  errors: Array<{ path: string; error: string }>
}

/**
 * Main entry point: import skills, agents, and rules from a GitHub URL.
 */
export async function importFromUrl(
  url: string,
  projectPath: string,
  saveToDb: boolean,
  userId?: string
): Promise<ImportResult> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    throw new Error(
      'URL invalida. Use uma URL do GitHub (ex: https://github.com/user/repo, .../tree/main/path, ou .../blob/main/file.md)'
    )
  }

  const { owner, repo, branch, subpath, isFile } = parsed

  // If it's a single file URL (blob), import just that file directly
  if (isFile && subpath) {
    return importSingleFile(owner, repo, branch, subpath, projectPath, saveToDb, userId)
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

  // Discover items: skills (SKILL.md), agents, rules
  const discovered = discoverItems(allFiles, subpath)

  if (discovered.length === 0) {
    throw new Error(
      `Nenhum skill, agent ou rule encontrado${subpath ? ` em ${subpath}` : ''}. Encontrados ${allFiles.length} arquivos.`
    )
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

      // Fetch and write all files for this item, collecting contents for DB
      let filesWritten = 0
      const fileContents = new Map<string, string>()

      for (const filePath of item.files) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
          const content = await fetchText(rawUrl)
          fileContents.set(filePath, content)

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
          mkdirSync(dirname(targetPath), { recursive: true, mode: 0o775 })
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
          await saveItemToDb(item, owner, repo, branch, projectPath, fileContents, userId)
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

/**
 * Parse a GitHub URL into its components.
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string; branch: string; subpath: string; isFile: boolean } | null {
  // Blob URL (single file): github.com/user/repo/blob/branch/path/to/file.md
  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\/?$)/)
  if (blobMatch) {
    return {
      owner: blobMatch[1],
      repo: blobMatch[2],
      branch: blobMatch[3],
      subpath: blobMatch[4],
      isFile: true,
    }
  }

  // Tree URL (directory): github.com/user/repo/tree/branch/path
  const treeMatch = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+?))?(?:\/?$)/
  )
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2],
      branch: treeMatch[3],
      subpath: treeMatch[4] || '',
      isFile: false,
    }
  }

  // Repo root: github.com/user/repo
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/?$)/)
  if (repoMatch) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2],
      branch: 'main',
      subpath: '',
      isFile: false,
    }
  }

  return null
}

/**
 * Scan the file tree and discover skills, agents, and rules.
 */
export function discoverItems(files: GitHubTreeItem[], subpath: string): DiscoveredItem[] {
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

    // --- RULE: .md files inside any 'rules/' directory (not inside a skill folder) ---
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

export function isInsideAgentsDir(path: string, _subpath: string): boolean {
  const parts = path.toLowerCase().split('/')
  return parts.includes('agents')
}

export function isInsideRulesDir(path: string, _subpath: string): boolean {
  const parts = path.toLowerCase().split('/')
  return parts.includes('rules')
}

export function isRuleInsideSkill(rulePath: string, allFiles: GitHubTreeItem[]): boolean {
  const parts = rulePath.split('/')
  const rulesIdx = parts.findIndex((p) => p.toLowerCase() === 'rules')
  if (rulesIdx <= 0) return false

  // Check the parent directory of rules/
  const parentDir = parts.slice(0, rulesIdx).join('/')
  return allFiles.some((f) => f.path === `${parentDir}/SKILL.md`)
}

/**
 * Import a single file (skill SKILL.md or agent .md) from a blob URL.
 */
export async function importSingleFile(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  projectPath: string,
  saveToDb: boolean,
  userId?: string
): Promise<ImportResult> {
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
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const skillName = (frontmatter.name as string) || dir.split('/').pop() || 'unnamed-skill'

    if (projectPath) {
      try {
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        const treeResponse = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl)
        const siblingFiles = (treeResponse?.tree || []).filter(
          (f) => f.type === 'blob' && f.path.startsWith(dir + '/')
        )

        for (const sf of siblingFiles) {
          try {
            const sfContent = await fetchText(
              `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sf.path}`
            )
            const relativePath = sf.path.substring(dir.length + 1)
            const targetPath = join(projectPath, '.claude', 'skills', skillName, relativePath)
            mkdirSync(dirname(targetPath), { recursive: true, mode: 0o775 })
            writeFileSync(targetPath, sfContent, 'utf-8')
          } catch { /* skip */ }
        }
        imported.push({ type: 'skill', name: skillName, filesCount: siblingFiles.length })
      } catch {
        // Fallback: write just the SKILL.md
        const targetPath = join(projectPath, '.claude', 'skills', skillName, 'SKILL.md')
        mkdirSync(dirname(targetPath), { recursive: true, mode: 0o775 })
        writeFileSync(targetPath, content, 'utf-8')
        imported.push({ type: 'skill', name: skillName, filesCount: 1 })
      }
    }

    if (saveToDb) {
      try {
        const skillRepoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${dir}`
        const now = new Date()

        // Build file manifest from all sibling files
        const manifest: Array<{ path: string; content: string }> = []
        try {
          const treeUrl2 = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
          const treeResp = await fetchJson<{ tree: GitHubTreeItem[] }>(treeUrl2)
          const sibFiles = (treeResp?.tree || []).filter(
            (f) => f.type === 'blob' && f.path.startsWith(dir + '/')
          )
          for (const sf of sibFiles) {
            try {
              const sfContent = await fetchText(
                `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sf.path}`
              )
              manifest.push({ path: sf.path.substring(dir.length + 1), content: sfContent })
            } catch { /* skip */ }
          }
        } catch {
          manifest.push({ path: 'SKILL.md', content })
        }

        const githubFields = {
          repoOwner: owner,
          repoName: repo,
          repoBranch: branch,
          repoPath: dir,
          fileManifest: manifest,
          lastSyncedAt: now,
        }

        await prisma.skill.upsert({
          where: { name_userId: { name: skillName, userId: userId! } },
          update: {
            description:
              (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
            body,
            allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
            model: (frontmatter.model as string) || null,
            frontmatter: frontmatter as unknown as import('@prisma/client').Prisma.InputJsonValue,
            source: 'imported',
            repoUrl: skillRepoUrl,
            projectPath,
            ...githubFields,
          },
          create: {
            name: skillName,
            description:
              (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
            body,
            allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
            model: (frontmatter.model as string) || null,
            frontmatter: frontmatter as unknown as import('@prisma/client').Prisma.InputJsonValue,
            enabled: true,
            isGlobal: false,
            source: 'imported',
            repoUrl: skillRepoUrl,
            projectPath,
            ...githubFields,
            userId: userId!,
          },
        })
      } catch { /* non-fatal */ }
    }
  } else if (filename.endsWith('.md')) {
    const agentName = (frontmatter.name as string) || filename.replace(/\.md$/i, '')

    if (projectPath) {
      const targetPath = join(projectPath, '.claude', 'agents', `${agentName}.md`)
      mkdirSync(dirname(targetPath), { recursive: true, mode: 0o775 })
      writeFileSync(targetPath, content, 'utf-8')
      imported.push({ type: 'agent', name: agentName, filesCount: 1 })
    }

    if (saveToDb) {
      try {
        const agentRepoUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`
        const now = new Date()
        const githubFields = {
          repoOwner: owner,
          repoName: repo,
          repoBranch: branch,
          repoPath: filePath,
          lastSyncedAt: now,
        }

        await prisma.agent.upsert({
          where: { name_userId: { name: agentName, userId: userId! } },
          update: {
            description:
              (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
            systemPrompt: body,
            tools: toJsonArray(frontmatter.tools),
            disallowedTools: toJsonArray(
              frontmatter.disallowedTools || frontmatter['disallowed-tools']
            ),
            model: (frontmatter.model as string) || null,
            source: 'imported',
            repoUrl: agentRepoUrl,
            projectPath,
            ...githubFields,
          },
          create: {
            name: agentName,
            description:
              (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
            systemPrompt: body,
            tools: toJsonArray(frontmatter.tools),
            disallowedTools: toJsonArray(
              frontmatter.disallowedTools || frontmatter['disallowed-tools']
            ),
            model: (frontmatter.model as string) || null,
            permissionMode:
              (frontmatter.permissionMode as string) ||
              (frontmatter['permission-mode'] as string) ||
              'default',
            maxTurns: frontmatter.maxTurns
              ? parseInt(String(frontmatter.maxTurns), 10) || null
              : null,
            skills: toJsonArray(frontmatter.skills),
            enabled: true,
            isGlobal: false,
            source: 'imported',
            repoUrl: agentRepoUrl,
            projectPath,
            ...githubFields,
            userId: userId!,
          },
        })
      } catch { /* non-fatal */ }
    }
  } else {
    errors.push({ path: filePath, error: 'Tipo de arquivo nao reconhecido (esperava .md)' })
  }

  return { imported, skipped: [], errors }
}

/**
 * Save discovered item to database for UI management.
 * Stores structured GitHub info + full file manifest for skills.
 */
export async function saveItemToDb(
  item: DiscoveredItem,
  owner: string,
  repo: string,
  branch: string,
  projPath: string,
  fileContents: Map<string, string>,
  userId?: string
): Promise<void> {
  const repoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${item.dir}`
  const now = new Date()

  try {
    if (item.type === 'skill') {
      const skillMdPath = item.files.find((f) => f.toLowerCase().endsWith('skill.md'))
      if (!skillMdPath) return

      const skillMdContent =
        fileContents.get(skillMdPath) ||
        (await fetchText(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillMdPath}`
        ))
      const { frontmatter, body } = parseFrontmatter(skillMdContent)

      // Build file manifest with ALL skill files and their contents
      const manifest: Array<{ path: string; content: string }> = []
      for (const filePath of item.files) {
        const relativePath = filePath.substring(item.dir.length + 1)
        const content = fileContents.get(filePath)
        if (content !== undefined) {
          manifest.push({ path: relativePath, content })
        }
      }

      const githubFields = {
        repoOwner: owner,
        repoName: repo,
        repoBranch: branch,
        repoPath: item.dir,
        fileManifest: manifest,
        lastSyncedAt: now,
      }

      await prisma.skill.upsert({
        where: { name_userId: { name: item.name, userId: userId! } },
        update: {
          description:
            (frontmatter.description as string) ||
            `${item.files.length} arquivos de ${owner}/${repo}`,
          body,
          allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
          model: (frontmatter.model as string) || null,
          frontmatter: frontmatter as unknown as import('@prisma/client').Prisma.InputJsonValue,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
        },
        create: {
          name: item.name,
          description:
            (frontmatter.description as string) ||
            `${item.files.length} arquivos de ${owner}/${repo}`,
          body,
          allowedTools: toJsonArray(frontmatter['allowed-tools'] || frontmatter.allowedTools),
          model: (frontmatter.model as string) || null,
          frontmatter: frontmatter as unknown as import('@prisma/client').Prisma.InputJsonValue,
          enabled: true,
          isGlobal: false,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
          userId: userId!,
        },
      })
    } else if (item.type === 'agent') {
      const agentContent =
        fileContents.get(item.files[0]) ||
        (await fetchText(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.files[0]}`
        ))
      const { frontmatter, body } = parseFrontmatter(agentContent)

      const githubFields = {
        repoOwner: owner,
        repoName: repo,
        repoBranch: branch,
        repoPath: item.files[0],
        lastSyncedAt: now,
      }

      await prisma.agent.upsert({
        where: { name_userId: { name: item.name, userId: userId! } },
        update: {
          description:
            (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
          systemPrompt: body,
          tools: toJsonArray(frontmatter.tools),
          disallowedTools: toJsonArray(
            frontmatter.disallowedTools || frontmatter['disallowed-tools']
          ),
          model: (frontmatter.model as string) || null,
          permissionMode:
            (frontmatter.permissionMode as string) ||
            (frontmatter['permission-mode'] as string) ||
            'default',
          maxTurns: frontmatter.maxTurns
            ? parseInt(String(frontmatter.maxTurns), 10) || null
            : null,
          skills: toJsonArray(frontmatter.skills),
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
        },
        create: {
          name: item.name,
          description:
            (frontmatter.description as string) || `Importado de ${owner}/${repo}`,
          systemPrompt: body,
          tools: toJsonArray(frontmatter.tools),
          disallowedTools: toJsonArray(
            frontmatter.disallowedTools || frontmatter['disallowed-tools']
          ),
          model: (frontmatter.model as string) || null,
          permissionMode:
            (frontmatter.permissionMode as string) ||
            (frontmatter['permission-mode'] as string) ||
            'default',
          maxTurns: frontmatter.maxTurns
            ? parseInt(String(frontmatter.maxTurns), 10) || null
            : null,
          skills: toJsonArray(frontmatter.skills),
          enabled: true,
          isGlobal: false,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
          userId: userId!,
        },
      })
    } else if (item.type === 'rule') {
      const content =
        fileContents.get(item.files[0]) ||
        (await fetchText(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.files[0]}`
        ))

      const githubFields = {
        repoOwner: owner,
        repoName: repo,
        repoBranch: branch,
        repoPath: item.files[0],
        lastSyncedAt: now,
      }

      await prisma.rule.upsert({
        where: { name_userId: { name: item.name, userId: userId! } },
        update: {
          body: content,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
        },
        create: {
          name: item.name,
          body: content,
          enabled: true,
          isGlobal: false,
          source: 'imported',
          repoUrl,
          projectPath: projPath,
          ...githubFields,
          userId: userId!,
        },
      })
    }
  } catch {
    // Non-fatal: DB save is optional
  }
}
