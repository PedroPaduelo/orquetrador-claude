import { ClaudeCodeEngine } from './claude/claude-code-engine.js'
import type { CliEngine } from './types.js'

export type { CliEngine, EngineExecuteOptions, EngineExecuteResult, EngineAttachment } from './types.js'
export type { Action, StreamEvent } from './claude/stream-parser.js'

export function createEngine(_backend?: string): CliEngine {
  return new ClaudeCodeEngine()
}

export const defaultEngine: CliEngine = new ClaudeCodeEngine()
