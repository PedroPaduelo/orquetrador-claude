import type { WorkflowStep } from '@prisma/client'
import type { CliEngine } from '../engine/index.js'

export interface MessageAttachment {
  id: string
  filename: string
  mimeType: string
  path: string
  projectPath: string
  url: string
  size?: number
}

export interface ExecutionContext {
  conversationId: string
  workflowId: string
  steps: WorkflowStep[]
  projectPath: string
  attachments?: MessageAttachment[]
  userId?: string
  /** Max parallel steps for DAG execution. 0 or undefined = unlimited. */
  maxConcurrency?: number
}

export interface OrchestratorDeps {
  engine: CliEngine
  activeExecutions: Map<string, boolean>
}
