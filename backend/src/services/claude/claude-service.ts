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

    // Build the full message with context
    let fullMessage = message
    if (initialContext.length > 0 && !existingSessionId) {
      const contextStr = initialContext
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'Assistente'}: ${m.content}`)
        .join('\n\n')
      fullMessage = `Contexto anterior:\n${contextStr}\n\n---\n\nMensagem atual: ${message}`
    }

    args.push(fullMessage)

    // Set environment
    const env = { ...process.env }
    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl
    }

    return new Promise((resolve) => {
      const process = spawn('claude', args, {
        cwd: projectPath || undefined,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this.activeProcesses.set(processId, process)

      // Timeout handling
      let lastActivity = Date.now()
      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastActivity > this.timeout) {
          timedOut = true
          process.kill('SIGTERM')
          clearInterval(timeoutCheck)
        }
      }, 5000)

      // Handle stdout
      process.stdout?.on('data', (data: Buffer) => {
        lastActivity = Date.now()
        const chunk = data.toString()

        const events = parser.parse(chunk)
        for (const event of events) {
          if (event.type === 'content' && event.content) {
            content += event.content
          } else if (event.type === 'session' && event.sessionId) {
            sessionId = event.sessionId
          } else if (event.type === 'action' && event.action) {
            actions.push(event.action)
          }

          onEvent?.(event)
        }
      })

      // Handle stderr
      process.stderr?.on('data', (data: Buffer) => {
        lastActivity = Date.now()
        const stderrContent = data.toString()

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
      process.on('close', async (code) => {
        clearInterval(timeoutCheck)
        this.activeProcesses.delete(processId)
        parser.reset()

        // Save session if we got a new one
        if (sessionId) {
          await sessionManager.saveSession(conversationId, stepId, sessionId)
        }

        resolve({
          content,
          sessionId,
          actions,
          timedOut,
          cancelled,
          error: code !== 0 && !cancelled && !timedOut ? error || `Process exited with code ${code}` : undefined,
        })
      })

      // Handle process error
      process.on('error', (err) => {
        clearInterval(timeoutCheck)
        this.activeProcesses.delete(processId)
        parser.reset()

        resolve({
          content,
          sessionId,
          actions,
          timedOut: false,
          cancelled: false,
          error: err.message,
        })
      })
    })
  }

  cancel(conversationId: string): boolean {
    let cancelled = false

    for (const [processId, process] of this.activeProcesses) {
      if (processId.startsWith(conversationId)) {
        process.kill('SIGTERM')
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
