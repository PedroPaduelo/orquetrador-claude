import { prisma } from '../../../lib/prisma.js'
import type { StreamEvent, Metadata } from '../engine/types.js'

const MAX_RAW_SIZE = 50 * 1024 // 50KB per stdout/stderr

interface CompactEvent {
  t: number   // timestamp offset from start (ms)
  k: string   // event type
  d?: unknown // minimal metadata
}

interface FlushOptions {
  exitCode?: number | null
  signal?: string | null
  resultStatus: string
  errorMessage?: string
  contentLength: number
  actionsCount: number
  resumeTokenOut?: string | null
}

export class ExecutionMonitor {
  private executionId: string
  private conversationId: string
  private stepId: string
  private startedAt: Date
  private firstByteAt: Date | null = null
  private firstContentAt: Date | null = null
  private stdoutChunks: string[] = []
  private stderrChunks: string[] = []
  private stdoutSize = 0
  private stderrSize = 0
  private events: CompactEvent[] = []
  private commandLine = ''
  private envSnapshot = '{}'
  private messageLength = 0
  private systemPrompt: string | null = null
  private resumeToken: string | null = null
  private model: string | null = null
  private projectPath = ''
  private pid: number | null = null
  private inputTokens = 0
  private outputTokens = 0
  private cacheCreationInputTokens = 0
  private cacheReadInputTokens = 0
  private webSearchRequests = 0
  private webFetchRequests = 0

  // Accumulated metadata from stream-json events
  private metadata: Partial<Metadata> = {}

  constructor(executionId: string, conversationId: string, stepId: string) {
    this.executionId = executionId
    this.conversationId = conversationId
    this.stepId = stepId
    this.startedAt = new Date()
  }

  setInputMetadata(opts: {
    commandLine?: string
    messageLength?: number
    systemPrompt?: string | null
    resumeToken?: string | null
    model?: string | null
    projectPath?: string
    pid?: number | null
  }) {
    if (opts.commandLine !== undefined) this.commandLine = opts.commandLine
    if (opts.messageLength !== undefined) this.messageLength = opts.messageLength
    if (opts.systemPrompt !== undefined) this.systemPrompt = opts.systemPrompt ? opts.systemPrompt.substring(0, 500) : null
    if (opts.resumeToken !== undefined) this.resumeToken = opts.resumeToken
    if (opts.model !== undefined) this.model = opts.model
    if (opts.projectPath !== undefined) this.projectPath = opts.projectPath
    if (opts.pid !== undefined) this.pid = opts.pid
  }

  onStdout(chunk: string) {
    if (!this.firstByteAt) {
      this.firstByteAt = new Date()
    }
    if (this.stdoutSize < MAX_RAW_SIZE) {
      const remaining = MAX_RAW_SIZE - this.stdoutSize
      const toStore = chunk.length <= remaining ? chunk : chunk.substring(0, remaining)
      this.stdoutChunks.push(toStore)
      this.stdoutSize += toStore.length
    }
  }

  onStderr(chunk: string) {
    if (!this.firstByteAt) {
      this.firstByteAt = new Date()
    }
    if (this.stderrSize < MAX_RAW_SIZE) {
      const remaining = MAX_RAW_SIZE - this.stderrSize
      const toStore = chunk.length <= remaining ? chunk : chunk.substring(0, remaining)
      this.stderrChunks.push(toStore)
      this.stderrSize += toStore.length
    }
  }

  onParsedEvent(event: StreamEvent) {
    if (!this.firstContentAt && event.type === 'content') {
      this.firstContentAt = new Date()
    }

    const offset = Date.now() - this.startedAt.getTime()
    const compact: CompactEvent = { t: offset, k: event.type }

    if (event.type === 'action' && event.action) {
      compact.d = { type: event.action.type, name: event.action.name }
    } else if (event.type === 'error') {
      compact.d = { msg: event.error?.substring(0, 200) }
    } else if (event.type === 'session') {
      compact.d = { sid: event.sessionId }
    } else if (event.type === 'usage' && event.usage) {
      // Accumulate tokens from usage events
      this.inputTokens += event.usage.input_tokens
      this.outputTokens += event.usage.output_tokens
      this.cacheCreationInputTokens += event.usage.cache_creation_input_tokens
      this.cacheReadInputTokens += event.usage.cache_read_input_tokens

      // Accumulate server tool usage
      if (event.usage.server_tool_use) {
        this.webSearchRequests += event.usage.server_tool_use.web_search_requests
        this.webFetchRequests += event.usage.server_tool_use.web_fetch_requests
      }

      compact.d = {
        in: event.usage.input_tokens,
        out: event.usage.output_tokens,
        cacheIn: event.usage.cache_creation_input_tokens,
        cacheRead: event.usage.cache_read_input_tokens,
      }
    } else if (event.type === 'metadata' && event.metadata) {
      // Accumulate metadata from stream-json events
      Object.assign(this.metadata, event.metadata)
      compact.d = event.metadata
    }

    this.events.push(compact)
  }

  flush(opts: FlushOptions) {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - this.startedAt.getTime()

    // Fire-and-forget: don't await in the hot path
    prisma.executionTrace.create({
      data: {
        executionId: this.executionId,
        conversationId: this.conversationId,
        stepId: this.stepId,
        commandLine: this.commandLine,
        envSnapshot: this.envSnapshot,
        messageLength: this.messageLength,
        systemPrompt: this.systemPrompt,
        resumeToken: this.resumeToken,
        model: this.model,
        projectPath: this.projectPath,
        pid: this.pid,
        stdoutRaw: this.stdoutChunks.join(''),
        stderrRaw: this.stderrChunks.join(''),
        parsedEvents: JSON.stringify(this.events),
        startedAt: this.startedAt,
        firstByteAt: this.firstByteAt,
        firstContentAt: this.firstContentAt,
        completedAt,
        durationMs,
        exitCode: opts.exitCode ?? null,
        signal: opts.signal ?? null,
        resultStatus: opts.resultStatus,
        errorMessage: opts.errorMessage ?? null,
        contentLength: opts.contentLength,
        actionsCount: opts.actionsCount,
        resumeTokenOut: opts.resumeTokenOut ?? null,
        // Token usage
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        cacheCreationInputTokens: this.cacheCreationInputTokens,
        cacheReadInputTokens: this.cacheReadInputTokens,
        // Server tool usage
        webSearchRequests: this.webSearchRequests,
        webFetchRequests: this.webFetchRequests,
        // Cost and performance (from accumulated metadata)
        totalCostUsd: this.metadata.total_cost_usd,
        durationApiMs: this.metadata.duration_api_ms,
        numTurns: this.metadata.num_turns ?? 0,
        stopReason: this.metadata.stop_reason,
        // Claude Code metadata (from accumulated metadata)
        claudeCodeVersion: this.metadata.claude_code_version,
        outputStyle: this.metadata.output_style,
        fastModeState: this.metadata.fast_mode_state,
        permissionMode: this.metadata.permission_mode,
        sessionId: this.metadata.session_id,
        // Additional metadata (JSON fields)
        serviceTier: this.metadata.service_tier,
        inferenceGeo: this.metadata.inference_geo,
        iterations: this.metadata.iterations ? JSON.stringify(this.metadata.iterations) : undefined,
        modelUsage: this.metadata.model_usage ? JSON.stringify(this.metadata.model_usage) : undefined,
        permissionDenials: this.metadata.permission_denials ? JSON.stringify(this.metadata.permission_denials) : undefined,
        cacheCreation: this.metadata.cache_creation ? JSON.stringify(this.metadata.cache_creation) : undefined,
      },
    }).catch((err) => {
      console.error('[ExecutionMonitor] Failed to persist trace:', err.message)
    })
  }
}
