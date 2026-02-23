export { type Action, type StreamEvent } from './claude/stream-parser.js'

export interface EngineAttachment {
  id: string
  filename: string
  mimeType: string
  path: string
  projectPath: string
  url: string
  size?: number
}

export interface EngineExecuteOptions {
  conversationId: string
  stepId: string
  message: string
  systemPrompt?: string
  apiBaseUrl?: string
  projectPath: string
  model?: string
  attachments?: EngineAttachment[]
  resumeToken?: string | null
  contextMessages?: Array<{ role: string; content: string }>
  onEvent?: (event: import('./claude/stream-parser.js').StreamEvent) => void
  onRawStdout?: (chunk: string) => void
  onRawStderr?: (chunk: string) => void
}

export interface EngineExecuteResult {
  content: string
  resumeToken: string | null
  actions: import('./claude/stream-parser.js').Action[]
  timedOut: boolean
  cancelled: boolean
  needsUserInput: boolean
  exitCode?: number | null
  signal?: string | null
  error?: string
}

export interface CliEngine {
  execute(options: EngineExecuteOptions): Promise<EngineExecuteResult>
  cancel(conversationId: string): boolean
  hasActiveProcess(conversationId: string): boolean
}
