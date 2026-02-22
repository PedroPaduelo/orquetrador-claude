import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { StreamParser, type StreamEvent, type Action } from './stream-parser.js'
import { sessionManager } from './session-manager.js'

export interface MessageAttachment {
  id: string
  filename: string
  mimeType: string
  path: string
  projectPath: string
  url: string
  size?: number
}

export interface ExecuteOptions {
  conversationId: string
  stepId: string
  message: string
  systemPrompt?: string
  baseUrl?: string
  projectPath?: string
  backend?: string
  model?: string
  attachments?: MessageAttachment[]
  onEvent?: (event: StreamEvent) => void
}

// Tools that require user input - when detected, we kill the process
// so the user can answer before Claude continues with auto-answers
const USER_INPUT_TOOLS = new Set([
  'AskUserQuestion',
])

export interface ExecuteResult {
  content: string
  sessionId: string | null
  actions: Action[]
  timedOut: boolean
  cancelled: boolean
  needsUserInput: boolean
  error?: string
}

// ============================================
// SANDBOX CONFIGURATION
// ============================================
// Runs Claude CLI as a restricted user to prevent child processes from
// killing the orchestrator or accessing its files.
//
// The sandbox user (claude-sandbox) has:
//   - NO ability to send signals to processes owned by 'dev' (kill blocked)
//   - NO access to /workspace/orquetrador-claude/ (permission denied)
//   - READ/WRITE access to project directories (via 'dev' group membership)
//   - Access to the Claude CLI binary
//
// Set SANDBOX_ENABLED=false to disable (e.g., for debugging)
// ============================================
const SANDBOX_USER = process.env.SANDBOX_USER || 'claude-sandbox'
const SANDBOX_GROUP = process.env.SANDBOX_GROUP || 'dev'
const SANDBOX_ENABLED = process.env.SANDBOX_ENABLED !== 'false'

// Environment variables that MUST NOT leak to child processes
const ENV_BLOCKLIST = new Set([
  // Orchestrator internals
  'DATABASE_URL',
  'JWT_SECRET',
  'SMART_NOTES_API_KEY',
  'SMART_NOTES_API_URL',
  'GROQ_API_KEY',
  // Claude Code internal vars
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  // Process info that reveals orchestrator
  'npm_lifecycle_event',
  'npm_package_name',
  'npm_package_version',
])

export class ClaudeService {
  private activeProcesses = new Map<string, ChildProcess>()
  private cancelledProcesses = new Set<string>()
  private timeout = 5 * 60 * 1000 // 5 minutes
  private cachedClaudeBin: string | null = null

  /**
   * Resolve the absolute path to the Claude CLI binary.
   * Caches the result since the binary location doesn't change at runtime.
   * Uses absolute path because sudo resets PATH for security.
   */
  private resolveClaudeBin(): string {
    if (this.cachedClaudeBin) return this.cachedClaudeBin

    try {
      const resolved = execSync('which claude', { encoding: 'utf-8' }).trim()
      if (resolved) {
        this.cachedClaudeBin = resolved
        console.log(`[ClaudeService] Resolved claude binary: ${resolved}`)
        return resolved
      }
    } catch { /* which failed */ }

    // Fallback: common locations
    const candidates = [
      '/home/dev/.npm-global/bin/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.cachedClaudeBin = candidate
        console.log(`[ClaudeService] Found claude binary at: ${candidate}`)
        return candidate
      }
    }

    // Last resort
    this.cachedClaudeBin = 'claude'
    return 'claude'
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const {
      conversationId,
      stepId,
      message,
      systemPrompt,
      baseUrl,
      projectPath,
      model,
      attachments,
      onEvent,
    } = options

    const processId = `${conversationId}_${stepId}_${Date.now()}`
    const parser = new StreamParser()

    let content = ''
    let sessionId: string | null = null
    let actions: Action[] = []
    let timedOut = false
    let cancelled = false
    let needsUserInput = false
    let error: string | undefined
    let rawStdout = ''
    let rawStderr = ''

    // Get existing session ID if any
    const existingSessionId = await sessionManager.getSession(conversationId, stepId)

    // Get user-selected context only on cold start (no session yet)
    let selectedContext: Array<{ role: string; content: string }> = []
    if (!existingSessionId) {
      selectedContext = await sessionManager.getSelectedContext(conversationId)
    }

    // Build message: only include context if user explicitly selected messages
    let fullMessage = message
    if (selectedContext.length > 0 && !existingSessionId) {
      const contextStr = selectedContext
        .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
        .join('\n\n')
      fullMessage = `<selected-context>\n${contextStr}\n</selected-context>\n\n${message}`
    }

    // Build command arguments - DO NOT use shell:true, pass args as array
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ]

    if (existingSessionId) {
      args.push('--resume', existingSessionId)
    }

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }

    if (model) {
      args.push('--model', model)
    }

    // Resolve image paths from attachments
    // Use projectPath (copied to project dir) so sandbox user can access them
    const imagePaths: string[] = []
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.projectPath && existsSync(att.projectPath)) {
          imagePaths.push(att.projectPath)
        } else {
          // Fallback to uploads path
          const uploadsBasePath = join(process.cwd(), 'uploads', 'images')
          const fullPath = join(uploadsBasePath, att.path)
          if (existsSync(fullPath)) {
            imagePaths.push(fullPath)
          } else {
            console.log(`[ClaudeService] Warning: Attachment file not found: ${att.projectPath || fullPath}`)
          }
        }
      }
    }

    // Build the final prompt: user text + image references
    // Claude CLI gets one prompt argument. When images are attached,
    // we append their paths so the CLI reads them using the Read tool.
    let messageToSend = fullMessage.trim()
    if (imagePaths.length > 0) {
      const imageRefs = imagePaths.map(p => p).join('\n')
      if (messageToSend) {
        messageToSend = `${messageToSend}\n\n${imageRefs}`
      } else {
        messageToSend = imageRefs
      }
    }

    // The prompt is passed as a single positional argument
    if (messageToSend) {
      args.push(messageToSend)
    }

    // Build sanitized environment for the child process
    // Only pass what Claude CLI needs — block orchestrator secrets
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !ENV_BLOCKLIST.has(key)) {
        env[key] = value
      }
    }

    // Each step MUST have its own baseUrl configured
    if (!baseUrl) {
      return {
        content: '',
        sessionId: null,
        actions: [],
        timedOut: false,
        cancelled: false,
        needsUserInput: false,
        error: 'Este step nao tem uma Base URL configurada. Configure a URL no step do workflow antes de executar.',
      }
    }
    env.ANTHROPIC_BASE_URL = baseUrl

    // Set HOME for sandbox user so Claude CLI stores sessions correctly
    if (SANDBOX_ENABLED) {
      env.HOME = `/home/${SANDBOX_USER}`
    }

    // Validate and resolve projectPath
    const resolvedCwd = projectPath || process.cwd()
    if (projectPath && !existsSync(projectPath)) {
      return {
        content: '',
        sessionId: null,
        actions: [],
        timedOut: false,
        cancelled: false,
        needsUserInput: false,
        error: `O diretorio do projeto nao existe: ${projectPath}. Verifique o projectPath do workflow.`,
      }
    }

    // Resolve the claude binary path to an absolute path
    // This is critical for sandbox mode because sudo resets PATH
    const claudeBin = process.env.CLAUDE_BIN || this.resolveClaudeBin()

    // Ensure Claude binary dir is in PATH for sandbox (sudo resets PATH)
    if (SANDBOX_ENABLED && claudeBin.includes('/')) {
      const claudeBinDir = claudeBin.substring(0, claudeBin.lastIndexOf('/'))
      if (claudeBinDir && env.PATH && !env.PATH.includes(claudeBinDir)) {
        env.PATH = `${claudeBinDir}:${env.PATH}`
      }
    }

    // Log full execution details
    const logPrefix = `[Claude][${processId.substring(0, 8)}]`
    console.log(`${logPrefix} ========== EXECUTION START ==========`)
    console.log(`${logPrefix} CWD: ${resolvedCwd}`)
    console.log(`${logPrefix} Binary: ${claudeBin}`)
    console.log(`${logPrefix} Session: ${existingSessionId || 'new'}`)
    console.log(`${logPrefix} Base URL: ${baseUrl || env.ANTHROPIC_BASE_URL || 'default'}`)
    console.log(`${logPrefix} Model: ${model || 'default'}`)
    console.log(`${logPrefix} Message length: ${fullMessage.length} chars`)
    console.log(`${logPrefix} Attachments: ${attachments?.length || 0} images (${imagePaths.length} resolved)`)
    console.log(`${logPrefix} System prompt: ${systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'none'}`)
    console.log(`${logPrefix} ANTHROPIC_API_KEY set: ${!!env.ANTHROPIC_API_KEY}`)
    console.log(`${logPrefix} ANTHROPIC_AUTH_TOKEN set: ${!!env.ANTHROPIC_AUTH_TOKEN}`)
    console.log(`${logPrefix} ANTHROPIC_BASE_URL: ${env.ANTHROPIC_BASE_URL || 'not set'} (step: ${baseUrl || 'none'}, fallback: ${process.env.DEFAULT_BASE_URL || 'none'})`)

    const sanitizedArgs = args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a)
    console.log(`${logPrefix} Args: ${claudeBin} ${sanitizedArgs.join(' ')}`)

    // Emit debug info through SSE so frontend can see it
    const emitDebug = (msg: string) => {
      console.log(`${logPrefix} ${msg}`)
      const debugAction: Action = {
        type: 'stderr',
        content: `[debug] ${msg}`,
      }
      actions.push(debugAction)
      onEvent?.({
        type: 'action',
        action: debugAction,
      })
    }

    emitDebug(`Starting claude CLI - cwd: ${resolvedCwd}, session: ${existingSessionId || 'new'}, baseUrl: ${baseUrl || env.ANTHROPIC_BASE_URL || 'default'}, model: ${model || 'default'}, apiKey: ${!!env.ANTHROPIC_API_KEY}, authToken: ${!!env.ANTHROPIC_AUTH_TOKEN}, sandbox: ${SANDBOX_ENABLED ? SANDBOX_USER : 'disabled'}`)

    return new Promise((resolve) => {
      // Spawn the Claude CLI process
      // When SANDBOX_ENABLED, run as restricted user via sudo to prevent:
      //   1. Child killing orchestrator processes (different UID = EPERM on kill())
      //   2. Child reading orchestrator files (filesystem permissions block access)
      //   3. Child discovering orchestrator internals (env vars sanitized)
      let spawnCmd: string
      let spawnArgs: string[]

      if (SANDBOX_ENABLED) {
        spawnCmd = 'sudo'
        spawnArgs = [
          '-n',                             // non-interactive (no password prompt)
          '-u', SANDBOX_USER,               // run as sandbox user
          '-g', SANDBOX_GROUP,              // use dev group (for project file access)
          '--preserve-env',                 // pass our sanitized env
          '--',
          claudeBin,
          ...args,
        ]
      } else {
        spawnCmd = claudeBin
        spawnArgs = args
      }

      const childProcess = spawn(spawnCmd, spawnArgs, {
        cwd: resolvedCwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,  // Create new process group so we can kill entire tree
      })

      this.activeProcesses.set(processId, childProcess)

      emitDebug(`Process spawned PID: ${childProcess.pid}`)

      // Close stdin immediately - we pass the message as a CLI argument, not via stdin
      childProcess.stdin?.end()

      // Timeout handling - reset on any stdout/stderr activity
      let lastActivity = Date.now()
      const timeoutCheck = setInterval(() => {
        const elapsed = Date.now() - lastActivity
        if (elapsed > this.timeout) {
          emitDebug(`TIMEOUT after ${Math.round(elapsed / 1000)}s of inactivity. stdout: ${rawStdout.length} chars, stderr: ${rawStderr.length} chars`)
          timedOut = true
          // Kill entire process group
          const tPid = childProcess.pid
          if (tPid) {
            try { process.kill(-tPid, 'SIGTERM') } catch { childProcess.kill('SIGTERM') }
          } else {
            childProcess.kill('SIGTERM')
          }
          // Force kill after 5 seconds if SIGTERM doesn't work
          setTimeout(() => {
            if (tPid) { try { process.kill(-tPid, 'SIGKILL') } catch { /* ignore */ } }
            try { childProcess.kill('SIGKILL') } catch { /* ignore */ }
          }, 5000)
          clearInterval(timeoutCheck)
        }
      }, 5000)

      // Handle stdout - parse NDJSON stream
      childProcess.stdout?.on('data', (data: Buffer) => {
        lastActivity = Date.now()
        const chunk = data.toString()
        rawStdout += chunk

        // Log raw stdout for debugging (truncate if too long)
        const logChunk = chunk.length > 500 ? chunk.substring(0, 500) + `... (${chunk.length} total chars)` : chunk
        console.log(`${logPrefix}[stdout] ${logChunk.replace(/\n/g, '\\n')}`)

        const events = parser.parse(chunk)
        for (const event of events) {
          if (event.type === 'content' && event.content) {
            content += event.content
          } else if (event.type === 'session' && event.sessionId) {
            sessionId = event.sessionId
            emitDebug(`Got session ID: ${sessionId}`)
          } else if (event.type === 'action' && event.action) {
            actions.push(event.action)

            // Detect tools that need user input - kill process immediately
            // to prevent Claude from auto-answering and continuing
            if (event.action.type === 'tool_use' && event.action.name && USER_INPUT_TOOLS.has(event.action.name)) {
              needsUserInput = true
              emitDebug(`${event.action.name} detected - killing process to wait for user input`)
              const uPid = childProcess.pid
              if (uPid) {
                try { process.kill(-uPid, 'SIGTERM') } catch { childProcess.kill('SIGTERM') }
              } else {
                childProcess.kill('SIGTERM')
              }
              setTimeout(() => {
                if (uPid) { try { process.kill(-uPid, 'SIGKILL') } catch { /* ignore */ } }
                try { childProcess.kill('SIGKILL') } catch { /* ignore */ }
              }, 2000)
            }
          } else if (event.type === 'error' && event.error) {
            error = event.error
            emitDebug(`Stream error: ${event.error}`)
          }

          onEvent?.(event)
        }
      })

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        lastActivity = Date.now()
        const stderrContent = data.toString()
        rawStderr += stderrContent

        console.log(`${logPrefix}[stderr] ${stderrContent}`)

        // Check for actual errors (not just warnings/info)
        const isActualError = stderrContent.includes('Error:') ||
          stderrContent.includes('ENOENT') ||
          stderrContent.includes('EACCES') ||
          stderrContent.includes('Cannot find') ||
          stderrContent.includes('Authentication') ||
          stderrContent.includes('API key')
        if (isActualError) {
          error = stderrContent.trim()
        }

        const stderrAction: Action = {
          type: 'stderr',
          content: stderrContent,
        }
        actions.push(stderrAction)
        onEvent?.({
          type: 'action',
          action: stderrAction,
        })
      })

      // Handle process close
      childProcess.on('close', async (code, signal) => {
        clearInterval(timeoutCheck)
        this.activeProcesses.delete(processId)
        parser.reset()

        // Check if this process was externally cancelled
        if (this.cancelledProcesses.has(processId)) {
          this.cancelledProcesses.delete(processId)
          cancelled = true
        }

        console.log(`${logPrefix} ========== EXECUTION END ==========`)
        console.log(`${logPrefix} Exit code: ${code}, Signal: ${signal}`)
        console.log(`${logPrefix} Content length: ${content.length} chars`)
        console.log(`${logPrefix} Session ID: ${sessionId}`)
        console.log(`${logPrefix} Actions count: ${actions.length}`)
        console.log(`${logPrefix} Timed out: ${timedOut}, Cancelled: ${cancelled}, Needs user input: ${needsUserInput}`)
        console.log(`${logPrefix} Raw stdout total: ${rawStdout.length} chars`)
        console.log(`${logPrefix} Raw stderr total: ${rawStderr.length} chars`)

        // If empty content, log full raw output for debugging
        if (content.length === 0) {
          console.log(`${logPrefix} WARNING: Empty content!`)
          console.log(`${logPrefix} Full raw stdout: ${rawStdout.substring(0, 2000)}`)
          console.log(`${logPrefix} Full raw stderr: ${rawStderr.substring(0, 2000)}`)
        }

        // Save session if we got a new one
        if (sessionId) {
          await sessionManager.saveSession(conversationId, stepId, sessionId)
        }

        // Determine error
        let finalError: string | undefined
        if (needsUserInput) {
          // Not an error - process was killed to wait for user input
          finalError = undefined
        } else if (timedOut) {
          finalError = `Timeout apos ${this.timeout / 1000}s sem atividade. stderr: ${rawStderr.substring(0, 500) || 'vazio'}. stdout: ${rawStdout.substring(0, 200) || 'vazio'}`
        } else if (cancelled) {
          finalError = undefined
        } else if (code !== null && code !== 0) {
          finalError = error || `Processo saiu com codigo ${code}. stderr: ${rawStderr.substring(0, 500) || 'vazio'}`
        } else if (content.length === 0 && rawStdout.length === 0) {
          finalError = `Processo completou mas nao produziu output. Exit code: ${code}. stderr: ${rawStderr.substring(0, 500) || 'vazio'}`
        } else if (content.length === 0 && actions.length === 0 && rawStdout.length > 0) {
          finalError = `Processo produziu output (${rawStdout.length} chars) mas parser nao extraiu conteudo. Raw: ${rawStdout.substring(0, 500)}`
        }

        // Build content from actions if no direct text content was parsed
        let finalContent = content
        if (!finalContent && actions.length > 0) {
          // Extract useful content from actions (thinking, tool results, etc.)
          const parts: string[] = []
          for (const action of actions) {
            if (action.type === 'thinking' && action.content) {
              parts.push(action.content)
            } else if (action.type === 'tool_result' && action.output) {
              const output = typeof action.output === 'string' ? action.output : JSON.stringify(action.output)
              parts.push(output)
            } else if (action.type === 'tool_use' && action.name) {
              // Don't add tool_use to content, it's tracked as an action
            }
          }
          if (parts.length > 0) {
            finalContent = parts.join('\n\n')
          }
        }
        // Last resort fallback
        if (!finalContent && rawStdout.length > 0) {
          finalContent = `[output nao parseado]\n${rawStdout}`
        }
        finalContent = finalContent || ''

        resolve({
          content: finalContent,
          sessionId,
          actions,
          timedOut,
          cancelled,
          needsUserInput,
          error: finalError,
        })
      })

      // Handle process error (e.g., command not found)
      childProcess.on('error', (err) => {
        clearInterval(timeoutCheck)
        this.activeProcesses.delete(processId)
        parser.reset()

        console.log(`${logPrefix} Process spawn error: ${err.message}`)

        resolve({
          content,
          sessionId,
          actions,
          timedOut: false,
          cancelled: false,
          needsUserInput: false,
          error: `Erro ao iniciar processo: ${err.message}`,
        })
      })
    })
  }

  cancel(conversationId: string): boolean {
    let cancelled = false

    for (const [processId, childProcess] of this.activeProcesses) {
      if (processId.startsWith(conversationId)) {
        const pid = childProcess.pid
        console.log(`[ClaudeService] Cancelling process ${processId} (PID: ${pid})`)

        // Mark as cancelled so the close handler sets cancelled=true in the result
        this.cancelledProcesses.add(processId)

        // Strategy: use multiple kill approaches to ensure the process tree dies
        // 1. Kill the process group (handles most cases)
        // 2. Kill child processes via pkill (handles sudo subprocess trees)
        // 3. Direct kill as fallback
        // 4. Force SIGKILL after 2 seconds

        if (pid) {
          // Try process group kill first
          try {
            process.kill(-pid, 'SIGTERM')
          } catch { /* ignore */ }

          // Also kill all child processes of this PID (handles sudo → claude tree)
          try {
            execSync(`pkill -TERM -P ${pid} 2>/dev/null; true`, { timeout: 2000 })
          } catch { /* ignore */ }

          // Direct kill
          try {
            process.kill(pid, 'SIGTERM')
          } catch { /* ignore */ }
        } else {
          childProcess.kill('SIGTERM')
        }

        // Force SIGKILL after 2 seconds if SIGTERM doesn't work
        setTimeout(() => {
          if (pid) {
            try { process.kill(-pid, 'SIGKILL') } catch { /* dead */ }
            try { execSync(`pkill -KILL -P ${pid} 2>/dev/null; true`, { timeout: 2000 }) } catch { /* ignore */ }
            try { process.kill(pid, 'SIGKILL') } catch { /* dead */ }
          }
          try { childProcess.kill('SIGKILL') } catch { /* dead */ }

          // Clean up from activeProcesses in case close event didn't fire
          this.activeProcesses.delete(processId)
        }, 2000)

        cancelled = true
      }
    }

    return cancelled
  }

  hasActiveProcess(conversationId: string): boolean {
    for (const processId of this.activeProcesses.keys()) {
      if (processId.startsWith(conversationId)) {
        return true
      }
    }
    return false
  }
}

export const claudeService = new ClaudeService()
