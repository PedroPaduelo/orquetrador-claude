import { spawn, ChildProcess } from 'child_process'
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

export interface ExecuteResult {
  content: string
  sessionId: string | null
  actions: Action[]
  timedOut: boolean
  cancelled: boolean
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

    // Build command arguments
    const args = ['--print', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']

    if (existingSessionId) {
      args.push('--resume', existingSessionId)
    }

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }

    if (model) {
      args.push('--model', model)
    }

    // Build the full message with context
    let fullMessage = message
    if (initialContext.length > 0 && !existingSessionId) {
      const contextStr = initialContext
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'Assistente'}: ${m.content}`)
        .join('\n\n')
      fullMessage = `Contexto anterior:\n${contextStr}\n\n---\n\nMensagem atual: ${message}`
    }

    args.push(fullMessage)

    // Set environment - remove all Claude Code env vars to allow nested sessions
    const env = { ...process.env }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_ENTRYPOINT

    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl
    }

    // Log full execution details
    const logPrefix = `[Claude][${processId.substring(0, 8)}]`
    console.log(`${logPrefix} ========== EXECUTION START ==========`)
    console.log(`${logPrefix} CWD: ${projectPath || process.cwd()}`)
    console.log(`${logPrefix} Session: ${existingSessionId || 'new'}`)
    console.log(`${logPrefix} Base URL: ${baseUrl || 'default (no override)'}`)
    console.log(`${logPrefix} Model: ${model || 'default'}`)
    console.log(`${logPrefix} Message length: ${fullMessage.length} chars`)
    console.log(`${logPrefix} System prompt: ${systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'none'}`)
    console.log(`${logPrefix} ANTHROPIC_API_KEY set: ${!!env.ANTHROPIC_API_KEY}`)
    console.log(`${logPrefix} ANTHROPIC_AUTH_TOKEN set: ${!!env.ANTHROPIC_AUTH_TOKEN}`)
    console.log(`${logPrefix} ANTHROPIC_BASE_URL: ${env.ANTHROPIC_BASE_URL || 'not set'}`)
    console.log(`${logPrefix} Args (sanitized): claude ${args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a).join(' ')}`)

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

    emitDebug(`Starting claude CLI - session: ${existingSessionId || 'new'}, baseUrl: ${baseUrl || 'default'}, model: ${model || 'default'}, apiKey: ${!!env.ANTHROPIC_API_KEY}, authToken: ${!!env.ANTHROPIC_AUTH_TOKEN}`)

    return new Promise((resolve) => {
      const childProcess = spawn('claude', args, {
        cwd: projectPath || undefined,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })

      this.activeProcesses.set(processId, childProcess)

      emitDebug(`Process spawned PID: ${childProcess.pid}`)

      // Timeout handling
      let lastActivity = Date.now()
      const timeoutCheck = setInterval(() => {
        const elapsed = Date.now() - lastActivity
        if (elapsed > this.timeout) {
          emitDebug(`TIMEOUT after ${Math.round(elapsed / 1000)}s of inactivity. stdout: ${rawStdout.length} chars, stderr: ${rawStderr.length} chars`)
          timedOut = true
          childProcess.kill('SIGTERM')
          clearInterval(timeoutCheck)
        }
      }, 5000)

      // Handle stdout - log ALL raw data
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
          } else if (event.type === 'error' && event.error) {
            error = event.error
            emitDebug(`Stream error: ${event.error}`)
          }

          onEvent?.(event)
        }
      })

      // Handle stderr - log ALL raw data
      childProcess.stderr?.on('data', (data: Buffer) => {
        lastActivity = Date.now()
        const stderrContent = data.toString()
        rawStderr += stderrContent

        console.log(`${logPrefix}[stderr] ${stderrContent}`)

        // Check for errors
        if (stderrContent.includes('Error') || stderrContent.includes('error')) {
          error = stderrContent
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
        console.log(`${logPrefix} Timed out: ${timedOut}, Cancelled: ${cancelled}`)
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

        // Determine error - FIX: properly handle timeout and empty content cases
        let finalError: string | undefined
        if (timedOut) {
          finalError = `Timeout após ${this.timeout / 1000}s sem atividade. stderr: ${rawStderr.substring(0, 500) || 'vazio'}. stdout: ${rawStdout.substring(0, 200) || 'vazio'}`
        } else if (cancelled) {
          finalError = undefined
        } else if (code !== 0) {
          finalError = error || `Processo saiu com código ${code}. stderr: ${rawStderr.substring(0, 500) || 'vazio'}`
        } else if (content.length === 0 && rawStdout.length === 0) {
          finalError = `Processo completou mas não produziu output. Exit code: ${code}. stderr: ${rawStderr.substring(0, 500) || 'vazio'}`
        } else if (content.length === 0 && rawStdout.length > 0) {
          finalError = `Processo produziu output (${rawStdout.length} chars) mas parser não extraiu conteúdo. Raw: ${rawStdout.substring(0, 500)}`
        }

        // If we have raw stdout but no parsed content, use raw as fallback
        const finalContent = content || (rawStdout.length > 0 ? `[output não parseado]\n${rawStdout}` : '')

        resolve({
          content: finalContent,
          sessionId,
          actions,
          timedOut,
          cancelled,
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
