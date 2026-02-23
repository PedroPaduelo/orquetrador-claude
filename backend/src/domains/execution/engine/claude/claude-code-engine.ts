import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { StreamParser, type StreamEvent, type Action } from './stream-parser.js'
import type { CliEngine, EngineExecuteOptions, EngineExecuteResult } from '../types.js'

const USER_INPUT_TOOLS = new Set([
  'AskUserQuestion',
])

const SANDBOX_USER = process.env.SANDBOX_USER || 'claude-sandbox'
const SANDBOX_GROUP = process.env.SANDBOX_GROUP || 'dev'
const SANDBOX_ENABLED = process.env.SANDBOX_ENABLED !== 'false'

const ENV_BLOCKLIST = new Set([
  'DATABASE_URL',
  'JWT_SECRET',
  'SMART_NOTES_API_KEY',
  'SMART_NOTES_API_URL',
  'GROQ_API_KEY',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'npm_lifecycle_event',
  'npm_package_name',
  'npm_package_version',
])

export class ClaudeCodeEngine implements CliEngine {
  private activeProcesses = new Map<string, ChildProcess>()
  private cancelledProcesses = new Set<string>()
  private cachedClaudeBin: string | null = null

  private resolveClaudeBin(): string {
    if (this.cachedClaudeBin) return this.cachedClaudeBin

    try {
      const resolved = execSync('which claude', { encoding: 'utf-8' }).trim()
      if (resolved) {
        this.cachedClaudeBin = resolved
        return resolved
      }
    } catch { /* which failed */ }

    const candidates = [
      '/home/dev/.npm-global/bin/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.cachedClaudeBin = candidate
        return candidate
      }
    }

    this.cachedClaudeBin = 'claude'
    return 'claude'
  }

  async execute(options: EngineExecuteOptions): Promise<EngineExecuteResult> {
    const {
      conversationId,
      stepId,
      message,
      systemPrompt,
      apiBaseUrl,
      projectPath,
      model,
      attachments,
      resumeToken,
      contextMessages,
      onEvent,
      onRawStdout,
      onRawStderr,
    } = options

    const processId = `${conversationId}_${stepId}_${Date.now()}`
    const parser = new StreamParser()

    let content = ''
    let sessionId: string | null = null
    let actions: Action[] = []
    let cancelled = false
    let needsUserInput = false
    let error: string | undefined
    let rawStdout = ''
    let rawStderr = ''
    let exitCode: number | null = null
    let exitSignal: string | null = null

    // Build message with context if provided
    let fullMessage = message
    if (contextMessages && contextMessages.length > 0 && !resumeToken) {
      const contextStr = contextMessages
        .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
        .join('\n\n')
      fullMessage = `<selected-context>\n${contextStr}\n</selected-context>\n\n${message}`
    }

    // Build command arguments
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ]

    if (resumeToken) {
      args.push('--resume', resumeToken)
    }

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }

    if (model) {
      args.push('--model', model)
    }

    // Resolve image paths from attachments
    const imagePaths: string[] = []
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.projectPath && existsSync(att.projectPath)) {
          imagePaths.push(att.projectPath)
        } else {
          const uploadsBasePath = join(process.cwd(), 'uploads', 'images')
          const fullPath = join(uploadsBasePath, att.path)
          if (existsSync(fullPath)) {
            imagePaths.push(fullPath)
          }
        }
      }
    }

    // Build the final prompt
    let messageToSend = fullMessage.trim()
    if (imagePaths.length > 0) {
      const imageRefs = imagePaths.join('\n')
      if (messageToSend) {
        messageToSend = `${messageToSend}\n\n${imageRefs}`
      } else {
        messageToSend = imageRefs
      }
    }

    if (messageToSend) {
      args.push(messageToSend)
    }

    // Build sanitized environment
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !ENV_BLOCKLIST.has(key)) {
        env[key] = value
      }
    }

    if (!apiBaseUrl) {
      return {
        content: '',
        resumeToken: null,
        actions: [],
        timedOut: false,
        cancelled: false,
        needsUserInput: false,
        error: 'Este step nao tem uma Base URL configurada. Configure a URL no step do workflow antes de executar.',
      }
    }
    env.ANTHROPIC_BASE_URL = apiBaseUrl

    if (SANDBOX_ENABLED) {
      env.HOME = `/home/${SANDBOX_USER}`
    }

    if (!projectPath) {
      return {
        content: '',
        resumeToken: null,
        actions: [],
        timedOut: false,
        cancelled: false,
        needsUserInput: false,
        error: 'projectPath nao foi fornecido. A conversa precisa ter um projectPath configurado.',
      }
    }
    if (!existsSync(projectPath)) {
      return {
        content: '',
        resumeToken: null,
        actions: [],
        timedOut: false,
        cancelled: false,
        needsUserInput: false,
        error: `O diretorio do projeto nao existe: ${projectPath}. Verifique o projectPath da conversa.`,
      }
    }
    const resolvedCwd = projectPath

    const claudeBin = process.env.CLAUDE_BIN || this.resolveClaudeBin()

    if (SANDBOX_ENABLED && claudeBin.includes('/')) {
      const claudeBinDir = claudeBin.substring(0, claudeBin.lastIndexOf('/'))
      if (claudeBinDir && env.PATH && !env.PATH.includes(claudeBinDir)) {
        env.PATH = `${claudeBinDir}:${env.PATH}`
      }
    }

    const logPrefix = `[Claude][${processId.substring(0, 8)}]`

    // Build command line string for monitoring (before spawn)
    const commandLine = SANDBOX_ENABLED
      ? `sudo -n -u ${SANDBOX_USER} -g ${SANDBOX_GROUP} --preserve-env -- ${claudeBin} ${args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a).join(' ')}`
      : `${claudeBin} ${args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a).join(' ')}`

    const emitDebug = (msg: string) => {
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

    emitDebug(`Starting claude CLI - cwd: ${resolvedCwd}, session: ${resumeToken || 'new'}, baseUrl: ${apiBaseUrl}, model: ${model || 'default'}, sandbox: ${SANDBOX_ENABLED ? SANDBOX_USER : 'disabled'}`)

    return new Promise((resolve) => {
      let spawnCmd: string
      let spawnArgs: string[]

      if (SANDBOX_ENABLED) {
        spawnCmd = 'sudo'
        spawnArgs = [
          '-n',
          '-u', SANDBOX_USER,
          '-g', SANDBOX_GROUP,
          '--preserve-env',
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
        detached: true,
      })

      this.activeProcesses.set(processId, childProcess)

      emitDebug(`Process spawned PID: ${childProcess.pid}`)

      childProcess.stdin?.end()

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString()
        rawStdout += chunk

        onRawStdout?.(chunk)

        const events = parser.parse(chunk)
        for (const event of events) {
          if (event.type === 'content' && event.content) {
            content += event.content
          } else if (event.type === 'session' && event.sessionId) {
            sessionId = event.sessionId
          } else if (event.type === 'action' && event.action) {
            actions.push(event.action)

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
          }

          onEvent?.(event)
        }
      })

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const stderrContent = data.toString()
        rawStderr += stderrContent

        onRawStderr?.(stderrContent)

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
      childProcess.on('close', (code, signal) => {
        this.activeProcesses.delete(processId)
        parser.reset()

        exitCode = code
        exitSignal = signal || null

        if (this.cancelledProcesses.has(processId)) {
          this.cancelledProcesses.delete(processId)
          cancelled = true
        }

        // Determine error
        let finalError: string | undefined
        if (needsUserInput) {
          finalError = undefined
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
          const parts: string[] = []
          for (const action of actions) {
            if (action.type === 'thinking' && action.content) {
              parts.push(action.content)
            } else if (action.type === 'tool_result' && action.output) {
              const output = typeof action.output === 'string' ? action.output : JSON.stringify(action.output)
              parts.push(output)
            }
          }
          if (parts.length > 0) {
            finalContent = parts.join('\n\n')
          }
        }
        if (!finalContent && rawStdout.length > 0) {
          finalContent = `[output nao parseado]\n${rawStdout}`
        }
        finalContent = finalContent || ''

        resolve({
          content: finalContent,
          resumeToken: sessionId,
          actions,
          timedOut: false,
          cancelled,
          needsUserInput,
          exitCode,
          signal: exitSignal,
          error: finalError,
        })
      })

      // Handle process error
      childProcess.on('error', (err) => {
        this.activeProcesses.delete(processId)
        parser.reset()

        console.error(`${logPrefix} Process spawn error: ${err.message}`)

        resolve({
          content,
          resumeToken: sessionId,
          actions,
          timedOut: false,
          cancelled: false,
          needsUserInput: false,
          exitCode: null,
          signal: null,
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

        this.cancelledProcesses.add(processId)

        if (pid) {
          try { process.kill(-pid, 'SIGTERM') } catch { /* ignore */ }
          try { execSync(`pkill -TERM -P ${pid} 2>/dev/null; true`, { timeout: 2000 }) } catch { /* ignore */ }
          try { process.kill(pid, 'SIGTERM') } catch { /* ignore */ }
        } else {
          childProcess.kill('SIGTERM')
        }

        setTimeout(() => {
          if (pid) {
            try { process.kill(-pid, 'SIGKILL') } catch { /* dead */ }
            try { execSync(`pkill -KILL -P ${pid} 2>/dev/null; true`, { timeout: 2000 }) } catch { /* ignore */ }
            try { process.kill(pid, 'SIGKILL') } catch { /* dead */ }
          }
          try { childProcess.kill('SIGKILL') } catch { /* dead */ }
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
