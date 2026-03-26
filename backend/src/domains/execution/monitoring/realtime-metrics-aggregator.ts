/**
 * Realtime Metrics Aggregator
 *
 * In-memory rolling window (1 hour) that collects execution data from
 * orchestratorEvents and provides P50/P95/P99 latency, success/error rates,
 * cost analysis, and bottleneck detection per workflow.
 *
 * Data flows:
 *   orchestratorEvents → record*() methods → in-memory arrays
 *   GET /metrics/executions → getWorkflowMetrics() → aggregated response
 */

import { orchestratorEvents } from '../orchestrator/events.js'
import type {
  ExecutionCompleteEvent,
  StepCompleteEvent,
  StepErrorEvent,
  StepStartEvent,
} from '../orchestrator/events.js'
import { prisma } from '../../../lib/prisma.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutionRecord {
  executionId: string
  conversationId: string
  workflowId: string | null
  durationMs: number
  success: boolean
  tokenCost: number
  stepCount: number
  errorType: ErrorType | null
  timestamp: number // Date.now()
}

interface StepTimingRecord {
  executionId: string
  stepId: string
  stepName: string
  workflowId: string | null
  durationMs: number
  timestamp: number
}

interface StepErrorRecord {
  executionId: string
  stepId: string
  stepName: string
  workflowId: string | null
  errorType: ErrorType
  error: string
  timestamp: number
}

type ErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'context_overflow'
  | 'budget_exceeded'
  | 'permission_denied'
  | 'tool_error'
  | 'unknown'

// Transient state tracked while an execution is in-flight
interface InFlightExecution {
  executionId: string
  conversationId: string
  startedAt: number
  stepStarts: Map<string, { stepName: string; startedAt: number }>
  completedSteps: number
  errors: StepErrorRecord[]
}

// Aggregated output for a single workflow (or global)
export interface AggregatedMetrics {
  workflowId: string | null
  workflowName: string | null
  totalExecutions: number
  latency: {
    p50: number
    p95: number
    p99: number
    mean: number
    min: number
    max: number
  }
  successRate: number
  errorRate: number
  errorsByType: Record<ErrorType, number>
  avgCostPerExecution: number
  totalCost: number
  avgStepsCompleted: number
  bottleneck: {
    stepName: string
    avgDurationMs: number
  } | null
  windowStart: string
  windowEnd: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW_MS = 60 * 60 * 1000          // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const executionRecords: ExecutionRecord[] = []
const stepTimings: StepTimingRecord[] = []
const stepErrors: StepErrorRecord[] = []
const inFlightExecutions = new Map<string, InFlightExecution>()

// Cache: conversationId -> workflowId (avoids repeated DB lookups)
const workflowIdCache = new Map<string, string>()
// Cache: workflowId -> workflowName
const workflowNameCache = new Map<string, string>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

function classifyErrorType(errorMsg: string): ErrorType {
  const msg = errorMsg.toLowerCase()
  if (msg.includes('timeout') || msg.includes('excedeu o timeout')) return 'timeout'
  if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('429')) return 'rate_limit'
  if (msg.includes('prompt is too long') || msg.includes('prompt_too_long') || msg.includes('context_length') || msg.includes('max_tokens')) return 'context_overflow'
  if (msg.includes('budget') || msg.includes('limite diario') || msg.includes('limite mensal')) return 'budget_exceeded'
  if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('403')) return 'permission_denied'
  if (msg.includes('tool') && (msg.includes('error') || msg.includes('failed'))) return 'tool_error'
  return 'unknown'
}

async function resolveWorkflowId(conversationId: string): Promise<string | null> {
  const cached = workflowIdCache.get(conversationId)
  if (cached) return cached

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workflowId: true },
    })
    if (conv) {
      workflowIdCache.set(conversationId, conv.workflowId)
      return conv.workflowId
    }
  } catch {
    // Non-critical, return null
  }
  return null
}

async function resolveWorkflowName(workflowId: string): Promise<string | null> {
  const cached = workflowNameCache.get(workflowId)
  if (cached) return cached

  try {
    const wf = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { name: true },
    })
    if (wf) {
      workflowNameCache.set(workflowId, wf.name)
      return wf.name
    }
  } catch {
    // Non-critical
  }
  return null
}

function pruneOldRecords() {
  const cutoff = Date.now() - WINDOW_MS

  // Prune execution records
  while (executionRecords.length > 0 && executionRecords[0].timestamp < cutoff) {
    executionRecords.shift()
  }

  // Prune step timings
  while (stepTimings.length > 0 && stepTimings[0].timestamp < cutoff) {
    stepTimings.shift()
  }

  // Prune step errors
  while (stepErrors.length > 0 && stepErrors[0].timestamp < cutoff) {
    stepErrors.shift()
  }

  // Prune stale in-flight executions (> 2 hours old = likely leaked)
  const staleThreshold = Date.now() - 2 * WINDOW_MS
  for (const [key, flight] of inFlightExecutions) {
    if (flight.startedAt < staleThreshold) {
      inFlightExecutions.delete(key)
    }
  }

  // Prune workflow caches (keep max 500 entries)
  if (workflowIdCache.size > 500) {
    const entries = [...workflowIdCache.entries()]
    for (let i = 0; i < entries.length - 250; i++) {
      workflowIdCache.delete(entries[i][0])
    }
  }
  if (workflowNameCache.size > 500) {
    const entries = [...workflowNameCache.entries()]
    for (let i = 0; i < entries.length - 250; i++) {
      workflowNameCache.delete(entries[i][0])
    }
  }
}

// ---------------------------------------------------------------------------
// Event handlers (wired to orchestratorEvents)
// ---------------------------------------------------------------------------

async function onStepStart(event: StepStartEvent) {
  const { executionId, conversationId, stepId, stepName } = event
  let flight = inFlightExecutions.get(executionId)

  if (!flight) {
    flight = {
      executionId,
      conversationId,
      startedAt: Date.now(),
      stepStarts: new Map(),
      completedSteps: 0,
      errors: [],
    }
    inFlightExecutions.set(executionId, flight)
  }

  flight.stepStarts.set(stepId, { stepName, startedAt: Date.now() })
}

async function onStepComplete(event: StepCompleteEvent) {
  const { executionId, conversationId, stepId, stepName } = event
  const flight = inFlightExecutions.get(executionId)

  if (flight) {
    flight.completedSteps++

    const stepStart = flight.stepStarts.get(stepId)
    if (stepStart) {
      const durationMs = Date.now() - stepStart.startedAt
      const workflowId = await resolveWorkflowId(conversationId)

      stepTimings.push({
        executionId,
        stepId,
        stepName,
        workflowId,
        durationMs,
        timestamp: Date.now(),
      })

      flight.stepStarts.delete(stepId)
    }
  }
}

async function onStepError(event: StepErrorEvent) {
  const { executionId, conversationId, stepId, stepName, error } = event
  const workflowId = await resolveWorkflowId(conversationId)
  const errorType = classifyErrorType(error)

  const record: StepErrorRecord = {
    executionId,
    stepId,
    stepName,
    workflowId,
    errorType,
    error,
    timestamp: Date.now(),
  }

  stepErrors.push(record)

  const flight = inFlightExecutions.get(executionId)
  if (flight) {
    flight.errors.push(record)
  }
}

async function onExecutionComplete(event: ExecutionCompleteEvent) {
  const { executionId, conversationId, success } = event
  const flight = inFlightExecutions.get(executionId)
  const now = Date.now()

  const workflowId = await resolveWorkflowId(conversationId)

  // Calculate duration and cost from DB traces (most accurate)
  let durationMs = flight ? now - flight.startedAt : 0
  let tokenCost = 0
  let stepCount = flight?.completedSteps ?? 0
  let primaryErrorType: ErrorType | null = null

  try {
    const traces = await prisma.executionTrace.findMany({
      where: { executionId },
      select: {
        durationMs: true,
        totalCostUsd: true,
        resultStatus: true,
        errorCategory: true,
      },
    })

    if (traces.length > 0) {
      const totalTraceDuration = traces.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
      if (totalTraceDuration > 0) durationMs = totalTraceDuration
      tokenCost = traces.reduce((sum, t) => sum + (t.totalCostUsd ?? 0), 0)
      stepCount = traces.length

      if (!success) {
        const errorTrace = traces.find(t => t.errorCategory)
        if (errorTrace?.errorCategory) {
          primaryErrorType = errorTrace.errorCategory as ErrorType
        }
      }
    }
  } catch {
    // Use in-flight data as fallback
  }

  if (!success && !primaryErrorType && flight?.errors.length) {
    primaryErrorType = flight.errors[flight.errors.length - 1].errorType
  }

  executionRecords.push({
    executionId,
    conversationId,
    workflowId,
    durationMs,
    success,
    tokenCost,
    stepCount,
    errorType: success ? null : (primaryErrorType ?? 'unknown'),
    timestamp: now,
  })

  inFlightExecutions.delete(executionId)
}

// ---------------------------------------------------------------------------
// Aggregation API
// ---------------------------------------------------------------------------

export async function getWorkflowMetrics(workflowId?: string): Promise<AggregatedMetrics[]> {
  const cutoff = Date.now() - WINDOW_MS
  const windowStart = new Date(cutoff).toISOString()
  const windowEnd = new Date().toISOString()

  // Filter records within the window
  const filteredExecs = executionRecords.filter(r =>
    r.timestamp >= cutoff && (workflowId ? r.workflowId === workflowId : true),
  )
  const filteredStepTimings = stepTimings.filter(r =>
    r.timestamp >= cutoff && (workflowId ? r.workflowId === workflowId : true),
  )
  const filteredStepErrors = stepErrors.filter(r =>
    r.timestamp >= cutoff && (workflowId ? r.workflowId === workflowId : true),
  )

  // Group by workflowId
  const groups = new Map<string, {
    execs: ExecutionRecord[]
    timings: StepTimingRecord[]
    errors: StepErrorRecord[]
  }>()

  const groupKey = (wfId: string | null) => wfId ?? '__global__'

  for (const exec of filteredExecs) {
    const key = groupKey(exec.workflowId)
    let g = groups.get(key)
    if (!g) {
      g = { execs: [], timings: [], errors: [] }
      groups.set(key, g)
    }
    g.execs.push(exec)
  }

  for (const timing of filteredStepTimings) {
    const key = groupKey(timing.workflowId)
    let g = groups.get(key)
    if (!g) {
      g = { execs: [], timings: [], errors: [] }
      groups.set(key, g)
    }
    g.timings.push(timing)
  }

  for (const err of filteredStepErrors) {
    const key = groupKey(err.workflowId)
    let g = groups.get(key)
    if (!g) {
      g = { execs: [], timings: [], errors: [] }
      groups.set(key, g)
    }
    g.errors.push(err)
  }

  // If filtering by workflowId and nothing found, return empty
  if (workflowId && groups.size === 0) {
    return []
  }

  // Build aggregated metrics per group
  const results: AggregatedMetrics[] = []

  for (const [key, group] of groups) {
    const execs = group.execs
    if (execs.length === 0) continue

    const realWorkflowId = key === '__global__' ? null : key

    // Latency
    const durations = execs.map(e => e.durationMs).sort((a, b) => a - b)
    const totalDuration = durations.reduce((s, v) => s + v, 0)

    // Success / Error rates
    const successes = execs.filter(e => e.success).length
    const failures = execs.length - successes
    const successRate = execs.length > 0 ? Math.round((successes / execs.length) * 10000) / 100 : 0
    const errorRate = execs.length > 0 ? Math.round((failures / execs.length) * 10000) / 100 : 0

    // Errors by type
    const errorsByType: Record<ErrorType, number> = {
      timeout: 0,
      rate_limit: 0,
      context_overflow: 0,
      budget_exceeded: 0,
      permission_denied: 0,
      tool_error: 0,
      unknown: 0,
    }
    for (const exec of execs) {
      if (exec.errorType) {
        errorsByType[exec.errorType] = (errorsByType[exec.errorType] || 0) + 1
      }
    }
    // Also count from step-level errors
    for (const err of group.errors) {
      errorsByType[err.errorType] = (errorsByType[err.errorType] || 0) + 1
    }

    // Cost
    const totalCost = execs.reduce((s, e) => s + e.tokenCost, 0)
    const avgCost = execs.length > 0 ? Math.round((totalCost / execs.length) * 1_000_000) / 1_000_000 : 0

    // Average steps completed
    const avgSteps = execs.length > 0
      ? Math.round((execs.reduce((s, e) => s + e.stepCount, 0) / execs.length) * 100) / 100
      : 0

    // Bottleneck: which step takes longest on average
    const stepDurationMap = new Map<string, { totalMs: number; count: number }>()
    for (const timing of group.timings) {
      const existing = stepDurationMap.get(timing.stepName) || { totalMs: 0, count: 0 }
      existing.totalMs += timing.durationMs
      existing.count++
      stepDurationMap.set(timing.stepName, existing)
    }

    let bottleneck: AggregatedMetrics['bottleneck'] = null
    let maxAvgDuration = 0
    for (const [stepName, data] of stepDurationMap) {
      const avg = data.totalMs / data.count
      if (avg > maxAvgDuration) {
        maxAvgDuration = avg
        bottleneck = {
          stepName,
          avgDurationMs: Math.round(avg),
        }
      }
    }

    // Resolve workflow name
    let workflowName: string | null = null
    if (realWorkflowId) {
      workflowName = await resolveWorkflowName(realWorkflowId)
    }

    results.push({
      workflowId: realWorkflowId,
      workflowName,
      totalExecutions: execs.length,
      latency: {
        p50: Math.round(percentile(durations, 50)),
        p95: Math.round(percentile(durations, 95)),
        p99: Math.round(percentile(durations, 99)),
        mean: execs.length > 0 ? Math.round(totalDuration / execs.length) : 0,
        min: durations.length > 0 ? durations[0] : 0,
        max: durations.length > 0 ? durations[durations.length - 1] : 0,
      },
      successRate,
      errorRate,
      errorsByType,
      avgCostPerExecution: avgCost,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
      avgStepsCompleted: avgSteps,
      bottleneck,
      windowStart,
      windowEnd,
    })
  }

  // Sort by total executions descending
  results.sort((a, b) => b.totalExecutions - a.totalExecutions)

  return results
}

/**
 * Get a summary of in-flight executions (currently running).
 */
export function getInFlightSummary() {
  const flights: Array<{
    executionId: string
    conversationId: string
    runningForMs: number
    completedSteps: number
    activeSteps: string[]
  }> = []

  for (const flight of inFlightExecutions.values()) {
    flights.push({
      executionId: flight.executionId,
      conversationId: flight.conversationId,
      runningForMs: Date.now() - flight.startedAt,
      completedSteps: flight.completedSteps,
      activeSteps: [...flight.stepStarts.values()].map(s => s.stepName),
    })
  }

  return flights
}

/**
 * Get raw counts for quick health checks.
 */
export function getQuickStats() {
  const cutoff = Date.now() - WINDOW_MS
  const recent = executionRecords.filter(r => r.timestamp >= cutoff)
  const successes = recent.filter(r => r.success).length
  const failures = recent.length - successes

  return {
    totalInWindow: recent.length,
    successes,
    failures,
    successRate: recent.length > 0 ? Math.round((successes / recent.length) * 10000) / 100 : 0,
    inFlight: inFlightExecutions.size,
    windowMs: WINDOW_MS,
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: start / stop event listeners and cleanup timer
// ---------------------------------------------------------------------------

let listenersAttached = false

export function startRealtimeMetrics() {
  if (listenersAttached) return

  orchestratorEvents.on('step:start', onStepStart)
  orchestratorEvents.on('step:complete', onStepComplete)
  orchestratorEvents.on('step:error', onStepError)
  orchestratorEvents.on('execution:complete', onExecutionComplete)

  cleanupTimer = setInterval(pruneOldRecords, CLEANUP_INTERVAL_MS)
  listenersAttached = true

  console.log('[RealtimeMetrics] Started — listening to orchestratorEvents, 1h rolling window')
}

export function stopRealtimeMetrics() {
  if (!listenersAttached) return

  orchestratorEvents.off('step:start', onStepStart)
  orchestratorEvents.off('step:complete', onStepComplete)
  orchestratorEvents.off('step:error', onStepError)
  orchestratorEvents.off('execution:complete', onExecutionComplete)

  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }

  listenersAttached = false
  console.log('[RealtimeMetrics] Stopped')
}

/**
 * For testing: clear all in-memory data.
 */
export function resetRealtimeMetrics() {
  executionRecords.length = 0
  stepTimings.length = 0
  stepErrors.length = 0
  inFlightExecutions.clear()
  workflowIdCache.clear()
  workflowNameCache.clear()
}
