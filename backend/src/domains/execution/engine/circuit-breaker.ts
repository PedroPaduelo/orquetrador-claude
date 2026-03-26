import { EventEmitter } from 'events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit trips open (default: 5) */
  failureThreshold: number
  /** Time in ms to wait before transitioning from OPEN -> HALF_OPEN (default: 60 000) */
  resetTimeoutMs: number
  /** Max attempts allowed while HALF_OPEN before deciding (default: 2) */
  halfOpenMaxAttempts: number
}

export interface CircuitBreakerStateInfo {
  state: CircuitState
  consecutiveFailures: number
  halfOpenAttempts: number
  lastFailureAt: number | null
  openedAt: number | null
}

export interface CircuitBreakerTransitionEvent {
  apiBaseUrl: string
  from: CircuitState
  to: CircuitState
  consecutiveFailures: number
  timestamp: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxAttempts: 2,
}

// ---------------------------------------------------------------------------
// Per-URL circuit state
// ---------------------------------------------------------------------------

interface CircuitEntry {
  state: CircuitState
  consecutiveFailures: number
  halfOpenAttempts: number
  lastFailureAt: number | null
  openedAt: number | null
}

function newCircuitEntry(): CircuitEntry {
  return {
    state: CircuitState.CLOSED,
    consecutiveFailures: 0,
    halfOpenAttempts: 0,
    lastFailureAt: null,
    openedAt: null,
  }
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitBreaker extends EventEmitter {
  private readonly options: CircuitBreakerOptions
  private readonly circuits = new Map<string, CircuitEntry>()

  constructor(options?: Partial<CircuitBreakerOptions>) {
    super()
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Checks whether a request to `apiBaseUrl` should be allowed.
   *
   * - CLOSED  -> always allowed
   * - OPEN    -> check if resetTimeout has elapsed; if so, transition to
   *              HALF_OPEN and allow; otherwise reject.
   * - HALF_OPEN -> allow up to `halfOpenMaxAttempts` probes.
   *
   * Returns `null` when the request is allowed, or an error string when it
   * should be rejected immediately.
   */
  canExecute(apiBaseUrl: string): string | null {
    const entry = this.getOrCreate(apiBaseUrl)

    switch (entry.state) {
      case CircuitState.CLOSED:
        return null

      case CircuitState.OPEN: {
        const elapsed = Date.now() - (entry.openedAt ?? 0)
        if (elapsed >= this.options.resetTimeoutMs) {
          this.transition(apiBaseUrl, entry, CircuitState.HALF_OPEN)
          entry.halfOpenAttempts = 0
          return null // allow probe
        }
        const remainingSec = Math.ceil((this.options.resetTimeoutMs - elapsed) / 1000)
        return `Circuit breaker is OPEN for ${apiBaseUrl} - API temporarily unavailable. Retry in ${remainingSec}s.`
      }

      case CircuitState.HALF_OPEN: {
        if (entry.halfOpenAttempts < this.options.halfOpenMaxAttempts) {
          return null // allow probe
        }
        return `Circuit breaker is HALF_OPEN for ${apiBaseUrl} - waiting for probe results before allowing more requests.`
      }

      default:
        return null
    }
  }

  /**
   * Record a successful execution for the given API base URL.
   * Resets failure counters and returns circuit to CLOSED if needed.
   */
  recordSuccess(apiBaseUrl: string): void {
    const entry = this.getOrCreate(apiBaseUrl)

    if (entry.state === CircuitState.HALF_OPEN) {
      this.transition(apiBaseUrl, entry, CircuitState.CLOSED)
    }

    entry.consecutiveFailures = 0
    entry.halfOpenAttempts = 0
  }

  /**
   * Record a failed execution (actual API error) for the given API base URL.
   */
  recordFailure(apiBaseUrl: string): void {
    const entry = this.getOrCreate(apiBaseUrl)
    entry.consecutiveFailures++
    entry.lastFailureAt = Date.now()

    if (entry.state === CircuitState.HALF_OPEN) {
      // Probe failed - go back to OPEN
      entry.halfOpenAttempts++
      this.transition(apiBaseUrl, entry, CircuitState.OPEN)
      return
    }

    // CLOSED state - check if we hit the threshold
    if (
      entry.state === CircuitState.CLOSED &&
      entry.consecutiveFailures >= this.options.failureThreshold
    ) {
      this.transition(apiBaseUrl, entry, CircuitState.OPEN)
    }
  }

  /**
   * Track that a HALF_OPEN probe attempt was started.
   * Called right before the actual execution in HALF_OPEN state.
   */
  recordHalfOpenAttempt(apiBaseUrl: string): void {
    const entry = this.getOrCreate(apiBaseUrl)
    if (entry.state === CircuitState.HALF_OPEN) {
      entry.halfOpenAttempts++
    }
  }

  /**
   * Get current state info for a specific API base URL.
   */
  getState(apiBaseUrl: string): CircuitBreakerStateInfo {
    const entry = this.getOrCreate(apiBaseUrl)
    return {
      state: entry.state,
      consecutiveFailures: entry.consecutiveFailures,
      halfOpenAttempts: entry.halfOpenAttempts,
      lastFailureAt: entry.lastFailureAt,
      openedAt: entry.openedAt,
    }
  }

  /**
   * Get state info for all tracked URLs.
   */
  getAllStates(): Map<string, CircuitBreakerStateInfo> {
    const result = new Map<string, CircuitBreakerStateInfo>()
    for (const [url, entry] of this.circuits) {
      result.set(url, {
        state: entry.state,
        consecutiveFailures: entry.consecutiveFailures,
        halfOpenAttempts: entry.halfOpenAttempts,
        lastFailureAt: entry.lastFailureAt,
        openedAt: entry.openedAt,
      })
    }
    return result
  }

  /**
   * Manually reset the circuit for a specific URL back to CLOSED.
   */
  reset(apiBaseUrl: string): void {
    const entry = this.circuits.get(apiBaseUrl)
    if (entry) {
      const previousState = entry.state
      entry.state = CircuitState.CLOSED
      entry.consecutiveFailures = 0
      entry.halfOpenAttempts = 0
      entry.lastFailureAt = null
      entry.openedAt = null
      if (previousState !== CircuitState.CLOSED) {
        this.emitTransition(apiBaseUrl, previousState, CircuitState.CLOSED, 0)
      }
    }
  }

  /**
   * Reset all circuits.
   */
  resetAll(): void {
    for (const url of this.circuits.keys()) {
      this.reset(url)
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private getOrCreate(apiBaseUrl: string): CircuitEntry {
    let entry = this.circuits.get(apiBaseUrl)
    if (!entry) {
      entry = newCircuitEntry()
      this.circuits.set(apiBaseUrl, entry)
    }
    return entry
  }

  private transition(apiBaseUrl: string, entry: CircuitEntry, to: CircuitState): void {
    const from = entry.state
    if (from === to) return

    entry.state = to

    if (to === CircuitState.OPEN) {
      entry.openedAt = Date.now()
    } else if (to === CircuitState.CLOSED) {
      entry.openedAt = null
    }

    this.emitTransition(apiBaseUrl, from, to, entry.consecutiveFailures)
  }

  private emitTransition(
    apiBaseUrl: string,
    from: CircuitState,
    to: CircuitState,
    consecutiveFailures: number,
  ): void {
    const event: CircuitBreakerTransitionEvent = {
      apiBaseUrl,
      from,
      to,
      consecutiveFailures,
      timestamp: Date.now(),
    }
    this.emit('stateChange', event)

    const label = `[CircuitBreaker] ${apiBaseUrl}: ${from} -> ${to} (failures: ${consecutiveFailures})`
    console.log(label)
  }
}

// ---------------------------------------------------------------------------
// Helpers for the engine: classify whether a result is an "API error"
// ---------------------------------------------------------------------------

/**
 * Determines whether an EngineExecuteResult represents an actual API error
 * that should count against the circuit breaker.
 *
 * We intentionally EXCLUDE:
 * - Timeouts (infrastructure issue, not API failure)
 * - User cancellations
 * - AskUserQuestion / needsUserInput (normal flow)
 * - User interrupts
 */
export function isApiError(result: {
  error?: string
  timedOut: boolean
  cancelled: boolean
  needsUserInput: boolean
  interrupted?: boolean
  exitCode?: number | null
}): boolean {
  // Not an error at all
  if (!result.error) return false

  // These are not API failures
  if (result.timedOut) return false
  if (result.cancelled) return false
  if (result.needsUserInput) return false
  if (result.interrupted) return false

  // Heuristic: look for known API error patterns
  const err = result.error.toLowerCase()
  const apiErrorPatterns = [
    'api key',
    'authentication',
    'unauthorized',
    '401',
    '403',
    '429',         // rate limit
    '500',
    '502',
    '503',
    '504',
    'bad gateway',
    'service unavailable',
    'internal server error',
    'overloaded',
    'rate limit',
    'quota exceeded',
    'connection refused',
    'econnrefused',
    'econnreset',
    'enotfound',
    'fetch failed',
    'network error',
    'anthropic_base_url',
    'api error',
    'error_during_execution',
  ]

  return apiErrorPatterns.some(pattern => err.includes(pattern))
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const circuitBreaker = new CircuitBreaker()
