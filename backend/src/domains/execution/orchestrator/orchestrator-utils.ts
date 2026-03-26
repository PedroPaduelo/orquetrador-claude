import { createOrUpdateAggregate } from '../monitoring/execution-aggregate.service.js'
import { extractToolCallsForExecution } from '../monitoring/tool-call-extractor.js'

export function finalizeExecution(executionId: string, conversationId: string): void {
  Promise.all([
    extractToolCallsForExecution(executionId),
    createOrUpdateAggregate(executionId, conversationId),
  ]).catch(err => {
    console.error('[Orchestrator] Failed to finalize execution metrics:', err.message)
  })
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stepName: string): Promise<T> {
  if (timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step "${stepName}" excedeu o timeout de ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export function isPromptTooLongError(error: string | undefined): boolean {
  if (!error) return false
  const lower = error.toLowerCase()
  return lower.includes('prompt is too long') || lower.includes('prompt_too_long')
}

export function isSessionNotFoundError(error: string | undefined): boolean {
  if (!error) return false
  const lower = error.toLowerCase()
  return lower.includes('no conversation found with session id') || lower.includes('session not found') || lower.includes('session_not_found')
}

export function evaluateSkipCondition(condition: string, input: string, stepIndex: number): boolean {
  try {
    const cond = condition.trim().toLowerCase()
    if (cond === 'true') return true
    if (cond === 'false') return false
    if (cond === 'empty_input') return !input || input.trim().length === 0
    if (cond.startsWith('contains:')) {
      const keyword = condition.substring('contains:'.length).trim()
      return input.toLowerCase().includes(keyword.toLowerCase())
    }
    if (cond.startsWith('not_contains:')) {
      const keyword = condition.substring('not_contains:'.length).trim()
      return !input.toLowerCase().includes(keyword.toLowerCase())
    }
    if (cond.startsWith('step_index')) {
      const match = cond.match(/step_index\s*(>|<|>=|<=|==)\s*(\d+)/)
      if (match) {
        const op = match[1]
        const val = parseInt(match[2], 10)
        if (op === '>') return stepIndex > val
        if (op === '<') return stepIndex < val
        if (op === '>=') return stepIndex >= val
        if (op === '<=') return stepIndex <= val
        if (op === '==') return stepIndex === val
      }
    }
    return false
  } catch {
    return false
  }
}

export function backoffDelay(attempt: number): Promise<void> {
  const ms = Math.min(Math.pow(2, attempt) * 1000, 30000)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Safely extract maxConcurrency from a workflow's config JSON field.
 * Returns 0 (unlimited) if not set or invalid.
 */
export function getMaxConcurrency(config: unknown): number {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const val = (config as Record<string, unknown>).maxConcurrency
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      return Math.floor(val)
    }
  }
  return 0
}
