import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import type { Redis } from 'ioredis'

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
    content?: string
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
  stepName?: string
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

export interface ContextResetEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  reason: string
}

export interface ExecutionCancelledEvent {
  executionId: string
  conversationId: string
}

export interface DagBatchStartEvent {
  executionId: string
  conversationId: string
  stepIds: string[]
  batchIndex: number
}

export interface ValidationFailedEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  validatorType: string
  feedback: string
}

export interface ExecutionPausedEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  stepOrder: number
  resumeToken: string | null
  askUserQuestion?: {
    question: string
    options?: Array<{ label: string; description?: string }>
  }
}

export interface ExecutionResumedEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  stepOrder: number
}

export interface UserInterruptEvent {
  executionId: string
  conversationId: string
  stepId: string
  stepName: string
  userMessage: string
}

/** Channel prefix for Redis PubSub distributed events */
const CHANNEL_PREFIX = 'orchestrator:events'

/** Payload published over Redis */
interface DistributedEventPayload {
  event: string
  data: unknown
  instanceId: string
}

// Type-safe event emitter with optional distributed (Redis PubSub) support.
//
// Default behaviour is identical to a plain EventEmitter (single-process).
// When `enableDistributed()` is called the class will:
//   1. Publish every emitted event to a Redis channel.
//   2. Subscribe to that channel and re-emit events originating from OTHER instances.
//   3. Use per-conversation channels for targeted delivery (`orchestrator:events:{conversationId}`).
//
// If Redis becomes unavailable the local EventEmitter continues to work normally.
export class OrchestratorEvents extends EventEmitter {
  /** Unique identifier for this server instance – used to avoid echoing our own events */
  readonly instanceId: string = `${process.env.HOSTNAME ?? 'node'}-${process.pid}-${randomUUID().slice(0, 8)}`

  private _publisher: Redis | null = null
  private _subscriber: Redis | null = null
  private _distributed = false
  /** Tracks channels we have already subscribed to */
  private _subscribedChannels = new Set<string>()
  /** Guard flag: when true we are replaying a remote event locally and must NOT republish */
  private _replaying = false

  // ---------------------------------------------------------------------------
  // Distributed mode lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Enable distributed event propagation via Redis PubSub.
   *
   * @param publisher  – Redis connection dedicated to PUBLISH commands
   * @param subscriber – Redis connection dedicated to SUBSCRIBE commands (must be a separate connection)
   */
  enableDistributed(publisher: Redis, subscriber: Redis): void {
    if (this._distributed) return

    this._publisher = publisher
    this._subscriber = subscriber
    this._distributed = true

    // Listen for pattern-matched messages on orchestrator:events:*
    this._subscriber.on('pmessage', (_pattern: string, _channel: string, message: string) => {
      this._handleRedisMessage(message)
    })

    // Subscribe to the wildcard pattern
    this._subscriber.psubscribe(`${CHANNEL_PREFIX}:*`).catch((err) => {
      console.error('[DistributedEvents] Failed to psubscribe:', (err as Error).message)
    })

    // Also subscribe to the global channel (events without a conversationId, unlikely but safe)
    this._subscriber.subscribe(CHANNEL_PREFIX).catch((err) => {
      console.error('[DistributedEvents] Failed to subscribe to global channel:', (err as Error).message)
    })

    this._subscriber.on('message', (_channel: string, message: string) => {
      this._handleRedisMessage(message)
    })

    console.log(`[DistributedEvents] Enabled — instanceId=${this.instanceId}`)
  }

  /**
   * Disable distributed mode and clean up Redis subscriptions.
   */
  async disableDistributed(): Promise<void> {
    if (!this._distributed) return
    this._distributed = false

    try {
      if (this._subscriber) {
        await this._subscriber.punsubscribe(`${CHANNEL_PREFIX}:*`)
        await this._subscriber.unsubscribe(CHANNEL_PREFIX)
      }
    } catch {
      // Subscriber may already be disconnected
    }

    this._publisher = null
    this._subscriber = null
    this._subscribedChannels.clear()
    console.log('[DistributedEvents] Disabled')
  }

  get isDistributed(): boolean {
    return this._distributed
  }

  // ---------------------------------------------------------------------------
  // Override emit to also publish to Redis
  // ---------------------------------------------------------------------------

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    // Always emit locally first
    const hadListeners = super.emit(event, ...args)

    // If we are replaying a remote event, do NOT publish it back to Redis
    if (this._replaying) return hadListeners

    // Publish to Redis when distributed mode is active and the event is a string
    if (this._distributed && this._publisher && typeof event === 'string') {
      this._publishToRedis(event, args[0])
    }

    return hadListeners
  }

  // ---------------------------------------------------------------------------
  // Typed emitters (unchanged API surface)
  // ---------------------------------------------------------------------------

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

  emitContextReset(data: ContextResetEvent) {
    this.emit('context:reset', data)
  }

  emitExecutionCancelled(data: ExecutionCancelledEvent) {
    this.emit('execution:cancelled', data)
  }

  emitDagBatchStart(data: DagBatchStartEvent) {
    this.emit('dag:batch_start', data)
  }

  emitValidationFailed(data: ValidationFailedEvent) {
    this.emit('validation:failed', data)
  }

  emitExecutionPaused(data: ExecutionPausedEvent) {
    this.emit('execution:paused', data)
  }

  emitExecutionResumed(data: ExecutionResumedEvent) {
    this.emit('execution:resumed', data)
  }

  emitUserInterrupt(data: UserInterruptEvent) {
    this.emit('user:interrupt', data)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Publish an event to the appropriate Redis channel.
   * Uses `orchestrator:events:{conversationId}` when the payload contains a conversationId,
   * otherwise falls back to the global `orchestrator:events` channel.
   */
  private _publishToRedis(event: string, data: unknown): void {
    if (!this._publisher) return

    const payload: DistributedEventPayload = {
      event,
      data,
      instanceId: this.instanceId,
    }

    // Determine channel: use conversation-specific when possible
    const conversationId = (data as { conversationId?: string })?.conversationId
    const channel = conversationId
      ? `${CHANNEL_PREFIX}:${conversationId}`
      : CHANNEL_PREFIX

    const json = JSON.stringify(payload)

    this._publisher.publish(channel, json).catch((err) => {
      // Non-fatal: local EventEmitter still works
      console.warn('[DistributedEvents] Publish failed:', (err as Error).message)
    })
  }

  /**
   * Handle an incoming Redis PubSub message. If it originated from a different
   * instance, re-emit the event locally so that local SSE listeners pick it up.
   */
  private _handleRedisMessage(message: string): void {
    try {
      const payload = JSON.parse(message) as DistributedEventPayload

      // Ignore our own messages to avoid infinite loops
      if (payload.instanceId === this.instanceId) return

      // Re-emit locally with the replay guard active
      this._replaying = true
      try {
        super.emit(payload.event, payload.data)
      } finally {
        this._replaying = false
      }
    } catch (err) {
      console.warn('[DistributedEvents] Failed to parse message:', (err as Error).message)
    }
  }
}

export const orchestratorEvents = new OrchestratorEvents()
