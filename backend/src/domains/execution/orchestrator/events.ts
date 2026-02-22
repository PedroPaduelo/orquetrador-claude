import { EventEmitter } from 'events'

export interface StepStartEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  stepOrder: number
  totalSteps: number
}

export interface StepStreamEvent {
  executionId: string
  conversationId: string
  stepId: string
  type: 'content' | 'action'
  content?: string
  action?: {
    type: string
    name?: string
    input?: unknown
    output?: unknown
    id?: string
  }
}

export interface StepCompleteEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  stepOrder: number
  content: string
  sessionId?: string
  finished: boolean
  needsUserInput?: boolean
}

export interface StepErrorEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  error: string
}

export interface MessageSavedEvent {
  executionId: string
  conversationId: string
  messageId: string
  role: 'user' | 'assistant'
  content: string
  stepId?: string
  metadata?: Record<string, unknown>
  attachments?: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    path: string
    projectPath: string
    url: string
  }>
}

export interface ConditionRetryEvent {
  executionId: string
  conversationId: string
  stepId: string
  retryCount: number
  maxRetries: number
  retryMessage: string
}

export interface ConditionJumpEvent {
  executionId: string
  conversationId: string
  fromStepId: string
  toStepId: string
  toStepIndex: number
}

export interface ExecutionCompleteEvent {
  executionId: string
  conversationId: string
  success: boolean
}

export interface ExecutionCancelledEvent {
  executionId: string
  conversationId: string
}

// Type-safe event emitter
export class OrchestratorEvents extends EventEmitter {
  emitStepStart(data: StepStartEvent) {
    this.emit('step:start', data)
  }

  emitStepStream(data: StepStreamEvent) {
    this.emit('step:stream', data)
  }

  emitStepComplete(data: StepCompleteEvent) {
    this.emit('step:complete', data)
  }

  emitStepError(data: StepErrorEvent) {
    this.emit('step:error', data)
  }

  emitMessageSaved(data: MessageSavedEvent) {
    this.emit('message:saved', data)
  }

  emitConditionRetry(data: ConditionRetryEvent) {
    this.emit('condition:retry', data)
  }

  emitConditionJump(data: ConditionJumpEvent) {
    this.emit('condition:jump', data)
  }

  emitExecutionComplete(data: ExecutionCompleteEvent) {
    this.emit('execution:complete', data)
  }

  emitExecutionCancelled(data: ExecutionCancelledEvent) {
    this.emit('execution:cancelled', data)
  }
}

export const orchestratorEvents = new OrchestratorEvents()
