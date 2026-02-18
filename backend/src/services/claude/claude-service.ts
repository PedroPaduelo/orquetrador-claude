import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { StreamParser, type StreamEvent, type Action } from './stream-parser.js'
import { sessionManager } from './session-manager.js'

export interface ExecuteOptions {
  conversationId: string
  stepId: string
  message: string
  systemPrompt?: string
  baseUrl?: string
  projectPath?: string
  backend?: string
  model?: string
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

export class ClaudeService {
  private activeProcesses = new Map<string, ChildProcess>()
  private timeout = 5 * 60 * 1000 // 5 minutes

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const {
      conversationId,
      stepId,
      message,
      systemPrompt,
      baseUrl,
      projectPath,
      model,
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

    // Get initial context if no existing session
    let initialContext: Array<{ role: string; content: string }> = []
    if (!existingSessionId) {
      initialContext = await sessionManager.getInitialContext(conversationId)
    }

    // Build the full message with compact context summary
    let fullMessage = message
    if (initialContext.length > 0 && !existingSessionId) {
      const contextStr = initialContext
        .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
        .join('\n')
      fullMessage = `<context-summary>\n${contextStr}\n</context-summary>\n\n${message}`
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

    // The message is the last positional argument
    args.push(fullMessage)

    // Set environment - remove Claude Code internal env vars to allow nested sessions
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value
      }
    }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_ENTRYPOINT

    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl
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

    // Resolve the claude binary path
    const claudeBin = process.env.CLAUDE_BIN || 'claude'

    // Log full execution details
    const logPrefix = `[Claude][${processId.substring(0, 8)}]`
    console.log(`${logPrefix} ========== EXECUTION START ==========`)
    console.log(`${logPrefix} CWD: ${resolvedCwd}`)
    console.log(`${logPrefix} Binary: ${claudeBin}`)
    console.log(`${logPrefix} Session: ${existingSessionId || 'new'}`)
    console.log(`${logPrefix} Base URL: ${baseUrl || env.ANTHROPIC_BASE_URL || 'default'}`)
    console.log(`${logPrefix} Model: ${model || 'default'}`)
    console.log(`${logPrefix} Message length: ${fullMessage.length} chars`)
    console.log(`${logPrefix} System prompt: ${systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'none'}`)
    console.log(`${logPrefix} ANTHROPIC_API_KEY set: ${!!env.ANTHROPIC_API_KEY}`)
    console.log(`${logPrefix} ANTHROPIC_AUTH_TOKEN set: ${!!env.ANTHROPIC_AUTH_TOKEN}`)
    console.log(`${logPrefix} ANTHROPIC_BASE_URL: ${env.ANTHROPIC_BASE_URL || 'not set'}`)

    const sanitizedArgs = args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a)
    console.log(`${logPrefix} Args: ${claudeBin} ${sanitizedArgs.join(' ')}`)

    // Emit debug info through SSE so frontend can see it
    const emitDebug = (msg: string) => {
      console.log(`${logPrefix} ${msg}`)
      onEvent?.({
        type: 'action',
        action: {
          type: 'stderr',
          content: `[debug] ${msg}`,
        },
      })
    }

    emitDebug(`Starting claude CLI - cwd: ${resolvedCwd}, session: ${existingSessionId || 'new'}, baseUrl: ${baseUrl || env.ANTHROPIC_BASE_URL || 'default'}, model: ${model || 'default'}, apiKey: ${!!env.ANTHROPIC_API_KEY}, authToken: ${!!env.ANTHROPIC_AUTH_TOKEN}`)

    return new Promise((resolve) => {
      // Spawn WITHOUT shell:true - args are passed as an array which handles escaping
      const childProcess = spawn(claudeBin, args, {
        cwd: resolvedCwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
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
          childProcess.kill('SIGTERM')
          // Force kill after 5 seconds if SIGTERM doesn't work
          setTimeout(() => {
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
              childProcess.kill('SIGTERM')
              setTimeout(() => {
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

        onEvent?.({
          type: 'action',
          action: {
            type: 'stderr',
            content: stderrContent,
          },
        })
      })

      // Handle process close
      childProcess.on('close', async (code, signal) => {
        clearInterval(timeoutCheck)
        this.activeProcesses.delete(processId)
        parser.reset()

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
        childProcess.kill('SIGTERM')
        this.activeProcesses.delete(processId)
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
