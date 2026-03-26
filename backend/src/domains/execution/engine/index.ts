import { ClaudeCodeEngine } from './claude/claude-code-engine.js'
import type { CliEngine } from './types.js'

export type { CliEngine, EngineExecuteOptions, EngineExecuteResult, EngineAttachment } from './types.js'
export type { Action, StreamEvent } from './claude/stream-parser.js'
export { buildSystemPrompt, PROMPT_CACHE_ENABLED, getPromptCacheStats, clearBasePromptCache, CACHE_BREAKPOINT, CACHE_BLOCK_START, CACHE_BLOCK_END, CACHE_SECTION_BREAK } from './base-system-prompt.js'
export type { BuildSystemPromptOptions } from './base-system-prompt.js'
export { circuitBreaker, CircuitBreaker, CircuitState, isApiError } from './circuit-breaker.js'
export type { CircuitBreakerOptions, CircuitBreakerStateInfo, CircuitBreakerTransitionEvent } from './circuit-breaker.js'

export function createEngine(_backend?: string): CliEngine {
  return new ClaudeCodeEngine()
}

export const defaultEngine: CliEngine = new ClaudeCodeEngine()
