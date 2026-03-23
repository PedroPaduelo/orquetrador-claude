import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../lib/prisma.js'
import { BadRequestError, NotFoundError } from '../../http/errors/index.js'
import { encrypt, decrypt } from '../../lib/crypto.js'

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || '/workspace/temp-orquestrador'

function getUserProjectsDir(userId: string): string {
  return join(PROJECT_BASE_PATH, 'users', userId, 'projetos')
}

async function getUserGithubToken(userId: string): Promise<string | null> {
  // Use the user's first GitAccount as default token
  const account = await prisma.gitAccount.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { token: true },
  })
  return account?.token ? decrypt(account.token) : null
}

async function getTokenForProject(userId: string, projectPath: string): Promise<string | null> {
  // 1. Check if there's a project-specific git account mapping
  const mapping = await prisma.projectGitMapping.findUnique({
    where: { projectPath },
    include: { gitAccount: true },
  })

  if (mapping && mapping.gitAccount.userId === userId) {
    return decrypt(mapping.gitAccount.token)
  }

  // 2. Fall back to legacy user.githubToken
  return getUserGithubToken(userId)
}

async function validateGithubToken(token: string): Promise<{ valid: boolean; username: string | null }> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Execut-Orchestrator',
      },
    })
    if (!res.ok) return { valid: false, username: null }
    const data = await res.json() as { login: string }
    return { valid: true, username: data.login }
  } catch {
    return { valid: false, username: null }
  }
}

function runGit(args: string[], cwd: string, env?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, ...env },
  })
  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    exitCode: result.status ?? 1,
  }
}

function buildCloneUrl(repoUrl: string, token: string | null): string {
  if (!token) return repoUrl
  // https://github.com/user/repo.git -> https://x-access-token:TOKEN@github.com/user/repo.git
  try {
    const url = new URL(repoUrl)
    url.username = 'x-access-token'
    url.password = token
    return url.toString()
  } catch {
    return repoUrl
  }
}

function sanitizeOutput(text: string): string {
  // Remove tokens from output
  return text.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@')
}

export async function gitRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // ==========================================
  // GitHub Token Management (Legacy)
  // ==========================================

  // PUT /git/token — Save GitHub token
  server.put(
    '/git/token',
    {
      schema: {
        tags: ['Git'],
        summary: 'Save GitHub personal access token',
        body: z.object({
          token: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      // Upsert into GitAccount (legacy compatibility — creates a "Default" account)
      const existing = await prisma.gitAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      if (existing) {
        await prisma.gitAccount.update({
          where: { id: existing.id },
          data: { token: encrypt(request.body.token) },
        })
      } else {
        await prisma.gitAccount.create({
          data: { label: 'Default', token: encrypt(request.body.token), userId },
        })
      }
      return { success: true, message: 'Token salvo com sucesso' }
    }
  )

  // DELETE /git/token — Remove GitHub token
  server.delete(
    '/git/token',
    {
      schema: {
        tags: ['Git'],
        summary: 'Remove GitHub personal access token',
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      // Remove the oldest (default) GitAccount
      const existing = await prisma.gitAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      if (existing) {
        await prisma.gitAccount.delete({ where: { id: existing.id } })
      }
      return { success: true, message: 'Token removido' }
    }
  )

  // GET /git/token/status — Check if user has a GitHub token
  server.get(
    '/git/token/status',
    {
      schema: {
        tags: ['Git'],
        summary: 'Check if GitHub token is configured',
        response: {
          200: z.object({
            hasToken: z.boolean(),
            username: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const token = await getUserGithubToken(userId)
      if (!token) return { hasToken: false, username: null }

      // Validate token by fetching user info
      const { username } = await validateGithubToken(token)
      return { hasToken: true, username }
    }
  )

  // GET /git/repos — List user's GitHub repos (legacy, uses user.githubToken)
  server.get(
    '/git/repos',
    {
      schema: {
        tags: ['Git'],
        summary: 'List GitHub repositories for the authenticated user',
        querystring: z.object({
          page: z.coerce.number().default(1),
          perPage: z.coerce.number().default(30),
          sort: z.enum(['updated', 'created', 'pushed', 'full_name']).default('updated'),
        }),
        response: {
          200: z.array(z.object({
            id: z.number(),
            name: z.string(),
            fullName: z.string(),
            description: z.string().nullable(),
            private: z.boolean(),
            cloneUrl: z.string(),
            defaultBranch: z.string(),
            language: z.string().nullable(),
            updatedAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const token = await getUserGithubToken(userId)
      if (!token) throw new BadRequestError('GitHub token nao configurado')

      const { page, perPage, sort } = request.query
      const repos = await fetchGithubRepos(token, page, perPage, sort)
      return repos
    }
  )

  // ==========================================
  // Git Accounts (Multi-account support)
  // ==========================================

  // GET /git/accounts — List all git accounts for the user
  server.get(
    '/git/accounts',
    {
      schema: {
        tags: ['Git'],
        summary: 'List all git accounts for the user',
        response: {
          200: z.array(z.object({
            id: z.string(),
            label: z.string(),
            username: z.string().nullable(),
            createdAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const accounts = await prisma.gitAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      const results = await Promise.all(
        accounts.map(async (account) => {
          // Use cached username if available, otherwise validate
          let username = account.username
          if (!username) {
            const validation = await validateGithubToken(decrypt(account.token))
            username = validation.username
            // Cache the username if we got one
            if (username) {
              await prisma.gitAccount.update({
                where: { id: account.id },
                data: { username },
              })
            }
          }

          return {
            id: account.id,
            label: account.label,
            username,
            createdAt: account.createdAt.toISOString(),
          }
        })
      )

      return results
    }
  )

  // POST /git/accounts — Create a new git account
  server.post(
    '/git/accounts',
    {
      schema: {
        tags: ['Git'],
        summary: 'Create a new git account',
        body: z.object({
          label: z.string().min(1),
          token: z.string().min(1),
        }),
        response: {
          200: z.object({
            id: z.string(),
            label: z.string(),
            username: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { label, token } = request.body

      // Validate the token against GitHub API
      const { valid, username } = await validateGithubToken(token)
      if (!valid) {
        throw new BadRequestError('Token GitHub invalido ou expirado')
      }

      const account = await prisma.gitAccount.create({
        data: {
          label,
          token: encrypt(token),
          username,
          userId,
        },
      })

      return {
        id: account.id,
        label: account.label,
        username: account.username,
        createdAt: account.createdAt.toISOString(),
      }
    }
  )

  // PUT /git/accounts/:id — Update a git account
  server.put(
    '/git/accounts/:id',
    {
      schema: {
        tags: ['Git'],
        summary: 'Update a git account',
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          label: z.string().min(1).optional(),
          token: z.string().min(1).optional(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            label: z.string(),
            username: z.string().nullable(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { id } = request.params
      const { label, token } = request.body

      // Check ownership
      const existing = await prisma.gitAccount.findUnique({ where: { id } })
      if (!existing || existing.userId !== userId) {
        throw new NotFoundError('Conta git nao encontrada')
      }

      const updateData: { label?: string; token?: string; username?: string | null } = {}
      if (label !== undefined) updateData.label = label

      if (token !== undefined) {
        // Re-validate the new token
        const { valid, username } = await validateGithubToken(token)
        if (!valid) {
          throw new BadRequestError('Token GitHub invalido ou expirado')
        }
        updateData.token = encrypt(token)
        updateData.username = username
      }

      const account = await prisma.gitAccount.update({
        where: { id },
        data: updateData,
      })

      return {
        id: account.id,
        label: account.label,
        username: account.username,
        createdAt: account.createdAt.toISOString(),
      }
    }
  )

  // DELETE /git/accounts/:id — Delete a git account (cascades to project mappings)
  server.delete(
    '/git/accounts/:id',
    {
      schema: {
        tags: ['Git'],
        summary: 'Delete a git account',
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { id } = request.params

      // Check ownership
      const existing = await prisma.gitAccount.findUnique({ where: { id } })
      if (!existing || existing.userId !== userId) {
        throw new NotFoundError('Conta git nao encontrada')
      }

      await prisma.gitAccount.delete({ where: { id } })

      return { success: true, message: 'Conta git removida' }
    }
  )

  // GET /git/accounts/:id/repos — List repos for a specific git account
  server.get(
    '/git/accounts/:id/repos',
    {
      schema: {
        tags: ['Git'],
        summary: 'List GitHub repositories for a specific git account',
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().default(1),
          perPage: z.coerce.number().default(30),
          sort: z.enum(['updated', 'created', 'pushed', 'full_name']).default('updated'),
        }),
        response: {
          200: z.array(z.object({
            id: z.number(),
            name: z.string(),
            fullName: z.string(),
            description: z.string().nullable(),
            private: z.boolean(),
            cloneUrl: z.string(),
            defaultBranch: z.string(),
            language: z.string().nullable(),
            updatedAt: z.string(),
          })),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { id } = request.params

      // Check ownership
      const account = await prisma.gitAccount.findUnique({ where: { id } })
      if (!account || account.userId !== userId) {
        throw new NotFoundError('Conta git nao encontrada')
      }

      const { page, perPage, sort } = request.query
      const repos = await fetchGithubRepos(decrypt(account.token), page, perPage, sort)
      return repos
    }
  )

  // ==========================================
  // Project-Account Mapping
  // ==========================================

  // GET /git/project-account — Get the git account associated with a project
  server.get(
    '/git/project-account',
    {
      schema: {
        tags: ['Git'],
        summary: 'Get the git account associated with a project path',
        querystring: z.object({
          projectPath: z.string().min(1),
        }),
        response: {
          200: z.object({
            account: z.object({
              id: z.string(),
              label: z.string(),
              username: z.string().nullable(),
            }).nullable(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { projectPath } = request.query

      const mapping = await prisma.projectGitMapping.findUnique({
        where: { projectPath },
        include: { gitAccount: true },
      })

      if (!mapping || mapping.gitAccount.userId !== userId) {
        return { account: null }
      }

      return {
        account: {
          id: mapping.gitAccount.id,
          label: mapping.gitAccount.label,
          username: mapping.gitAccount.username,
        },
      }
    }
  )

  // ==========================================
  // Git Operations
  // ==========================================

  // POST /git/clone — Clone a repo into user's projects dir
  server.post(
    '/git/clone',
    {
      schema: {
        tags: ['Git'],
        summary: 'Clone a GitHub repository',
        body: z.object({
          repoUrl: z.string().url(),
          folderName: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
          branch: z.string().optional(),
          gitAccountId: z.string().uuid().optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            path: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { repoUrl, folderName, branch, gitAccountId } = request.body

      // Determine which token to use
      let token: string | null = null
      if (gitAccountId) {
        const account = await prisma.gitAccount.findUnique({ where: { id: gitAccountId } })
        if (!account || account.userId !== userId) {
          throw new NotFoundError('Conta git nao encontrada')
        }
        token = decrypt(account.token)
      } else {
        token = await getUserGithubToken(userId)
      }

      const userDir = getUserProjectsDir(userId)
      mkdirSync(userDir, { recursive: true, mode: 0o775 })

      // Derive folder name from repo URL if not provided
      const repoName = folderName || repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo'
      const targetDir = join(userDir, repoName)

      if (existsSync(targetDir)) {
        throw new BadRequestError(`Pasta "${repoName}" ja existe. Escolha outro nome.`)
      }

      const cloneUrl = buildCloneUrl(repoUrl, token)
      const args = ['clone', '--depth', '1']
      if (branch) args.push('--branch', branch)
      args.push(cloneUrl, targetDir)

      const result = runGit(args, userDir)

      if (result.exitCode !== 0) {
        throw new BadRequestError(`Erro ao clonar: ${sanitizeOutput(result.stderr)}`)
      }

      // Configure git user for this repo
      runGit(['config', 'user.email', 'execut@orchestrator.local'], targetDir)
      runGit(['config', 'user.name', 'Execut Orchestrator'], targetDir)

      // Unshallow so push/pull work properly
      runGit(['fetch', '--unshallow'], targetDir, token ? { GIT_ASKPASS: 'echo', GIT_TOKEN: token } : undefined)

      // Create project-git account mapping if a specific account was used
      if (gitAccountId) {
        await prisma.projectGitMapping.upsert({
          where: { projectPath: targetDir },
          create: {
            projectPath: targetDir,
            gitAccountId,
          },
          update: {
            gitAccountId,
          },
        })
      }

      return {
        success: true,
        path: targetDir,
        message: `Repositorio clonado em ${repoName}`,
      }
    }
  )

  // POST /git/status — Get git status for a project folder
  server.post(
    '/git/status',
    {
      schema: {
        tags: ['Git'],
        summary: 'Get git status for a project',
        body: z.object({
          projectPath: z.string(),
        }),
        response: {
          200: z.object({
            isRepo: z.boolean(),
            branch: z.string().nullable(),
            ahead: z.number(),
            behind: z.number(),
            modified: z.number(),
            untracked: z.number(),
            staged: z.number(),
            hasRemote: z.boolean(),
            remoteUrl: z.string().nullable(),
            lastCommit: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const { projectPath } = request.body

      if (!existsSync(projectPath)) {
        throw new NotFoundError('Diretorio nao encontrado')
      }

      const gitDir = runGit(['rev-parse', '--is-inside-work-tree'], projectPath)
      if (gitDir.stdout !== 'true') {
        return {
          isRepo: false, branch: null, ahead: 0, behind: 0,
          modified: 0, untracked: 0, staged: 0,
          hasRemote: false, remoteUrl: null, lastCommit: null,
        }
      }

      const branch = runGit(['branch', '--show-current'], projectPath).stdout || null
      const statusResult = runGit(['status', '--porcelain'], projectPath)
      const lines = statusResult.stdout ? statusResult.stdout.split('\n') : []

      let modified = 0, untracked = 0, staged = 0
      for (const line of lines) {
        const x = line[0], y = line[1]
        if (x === '?' && y === '?') untracked++
        else if (x !== ' ' && x !== '?') staged++
        else if (y !== ' ') modified++
      }

      const remoteResult = runGit(['remote', 'get-url', 'origin'], projectPath)
      const hasRemote = remoteResult.exitCode === 0
      const remoteUrl = hasRemote ? sanitizeOutput(remoteResult.stdout) : null

      // Fetch to check ahead/behind (use project-specific token for authenticated fetch)
      let ahead = 0, behind = 0
      if (hasRemote) {
        const token = await getTokenForProject(userId, projectPath)
        if (token) {
          // Temporarily set authenticated remote for fetch
          const authUrl = buildCloneUrl(remoteResult.stdout, token)
          runGit(['remote', 'set-url', 'origin', authUrl], projectPath)
        }

        runGit(['fetch', 'origin', '--quiet'], projectPath)

        if (token) {
          // Restore clean remote URL
          const cleanUrl = remoteResult.stdout.replace(/x-access-token:[^@]+@/, '')
          runGit(['remote', 'set-url', 'origin', cleanUrl], projectPath)
        }

        const ab = runGit(['rev-list', '--left-right', '--count', `HEAD...origin/${branch || 'main'}`], projectPath)
        if (ab.exitCode === 0) {
          const parts = ab.stdout.split(/\s+/)
          ahead = parseInt(parts[0]) || 0
          behind = parseInt(parts[1]) || 0
        }
      }

      const lastCommit = runGit(['log', '-1', '--format=%s (%ar)'], projectPath).stdout || null

      return {
        isRepo: true, branch, ahead, behind,
        modified, untracked, staged,
        hasRemote, remoteUrl, lastCommit,
      }
    }
  )

  // POST /git/pull — Pull latest changes
  server.post(
    '/git/pull',
    {
      schema: {
        tags: ['Git'],
        summary: 'Pull latest changes from remote',
        body: z.object({
          projectPath: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const token = await getTokenForProject(userId, request.body.projectPath)
      const { projectPath } = request.body

      if (!existsSync(projectPath)) {
        throw new NotFoundError('Diretorio nao encontrado')
      }

      // Set credentials for pull
      if (token) {
        const remoteResult = runGit(['remote', 'get-url', 'origin'], projectPath)
        if (remoteResult.exitCode === 0) {
          const authUrl = buildCloneUrl(remoteResult.stdout, token)
          runGit(['remote', 'set-url', 'origin', authUrl], projectPath)
        }
      }

      const result = runGit(['pull', '--rebase'], projectPath)

      // Remove token from remote URL after operation
      if (token) {
        const remoteResult = runGit(['remote', 'get-url', 'origin'], projectPath)
        if (remoteResult.exitCode === 0) {
          const cleanUrl = remoteResult.stdout.replace(/x-access-token:[^@]+@/, '')
          runGit(['remote', 'set-url', 'origin', cleanUrl], projectPath)
        }
      }

      if (result.exitCode !== 0) {
        throw new BadRequestError(`Erro no pull: ${sanitizeOutput(result.stderr)}`)
      }

      return { success: true, message: sanitizeOutput(result.stdout || 'Already up to date.') }
    }
  )

  // POST /git/push — Push commits to remote
  server.post(
    '/git/push',
    {
      schema: {
        tags: ['Git'],
        summary: 'Push commits to remote',
        body: z.object({
          projectPath: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()
      const token = await getTokenForProject(userId, request.body.projectPath)
      const { projectPath } = request.body

      if (!existsSync(projectPath)) {
        throw new NotFoundError('Diretorio nao encontrado')
      }

      if (!token) {
        throw new BadRequestError('GitHub token necessario para push')
      }

      // Set credentials for push
      const remoteResult = runGit(['remote', 'get-url', 'origin'], projectPath)
      if (remoteResult.exitCode === 0) {
        const authUrl = buildCloneUrl(remoteResult.stdout, token)
        runGit(['remote', 'set-url', 'origin', authUrl], projectPath)
      }

      const result = runGit(['push'], projectPath)

      // Clean token from remote URL after operation
      const remoteAfter = runGit(['remote', 'get-url', 'origin'], projectPath)
      if (remoteAfter.exitCode === 0) {
        const cleanUrl = remoteAfter.stdout.replace(/x-access-token:[^@]+@/, '')
        runGit(['remote', 'set-url', 'origin', cleanUrl], projectPath)
      }

      if (result.exitCode !== 0) {
        throw new BadRequestError(`Erro no push: ${sanitizeOutput(result.stderr)}`)
      }

      return { success: true, message: sanitizeOutput(result.stdout || result.stderr || 'Push realizado com sucesso') }
    }
  )

  // POST /git/init — Initialize a git repo and optionally link to remote
  server.post(
    '/git/init',
    {
      schema: {
        tags: ['Git'],
        summary: 'Initialize git repo in a project folder',
        body: z.object({
          projectPath: z.string(),
          remoteUrl: z.string().url().optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      await request.getCurrentUserId()
      const { projectPath, remoteUrl } = request.body

      if (!existsSync(projectPath)) {
        throw new NotFoundError('Diretorio nao encontrado')
      }

      runGit(['init'], projectPath)
      runGit(['config', 'user.email', 'execut@orchestrator.local'], projectPath)
      runGit(['config', 'user.name', 'Execut Orchestrator'], projectPath)

      if (remoteUrl) {
        runGit(['remote', 'add', 'origin', remoteUrl], projectPath)
      }

      return { success: true, message: 'Repositorio git inicializado' }
    }
  )
}

// ==========================================
// Shared helper: fetch repos from GitHub API
// ==========================================
async function fetchGithubRepos(
  token: string,
  page: number,
  perPage: number,
  sort: string,
) {
  const res = await fetch(
    `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&affiliation=owner,collaborator,organization_member`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Execut-Orchestrator',
      },
    }
  )
  if (!res.ok) throw new BadRequestError(`GitHub API error: ${res.status}`)

  const repos = await res.json() as Array<{
    id: number
    name: string
    full_name: string
    description: string | null
    private: boolean
    clone_url: string
    default_branch: string
    language: string | null
    updated_at: string
  }>

  return repos.map(r => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    cloneUrl: r.clone_url,
    defaultBranch: r.default_branch,
    language: r.language,
    updatedAt: r.updated_at,
  }))
}
