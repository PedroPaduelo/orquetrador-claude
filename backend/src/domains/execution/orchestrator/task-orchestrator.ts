import { defaultEngine, type CliEngine } from '../engine/index.js'
import { sessionManager } from '../session/session-manager.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import type { PausedExecutionInfo } from './execution-state.js'

export type { MessageAttachment, ExecutionContext } from './orchestrator-types.js'
import type { ExecutionContext, OrchestratorDeps } from './orchestrator-types.js'

import { executeSequential } from './sequential-executor.js'
import { executeDAGWorkflow } from './dag-workflow-executor.js'
import { executeStepByStep } from './step-by-step-executor.js'
import { resumeExecution } from './execution-resumer.js'

export class TaskOrchestrator {
  private activeExecutions = new Map<string, boolean>()
  private engine: CliEngine
  private deps: OrchestratorDeps

  constructor(engine?: CliEngine) {
    this.engine = engine || defaultEngine
    this.deps = {
      engine: this.engine,
      activeExecutions: this.activeExecutions,
    }
  }

  async executeStep(
    executionId: string,
    conversationId: string,
    step: import('@prisma/client').WorkflowStep,
    input: string,
    projectPath: string,
    attachments?: import('./orchestrator-types.js').MessageAttachment[],
    userId?: string,
  ) {
    const { executeStep: exec } = await import('./step-executor.js')
    return exec(this.deps, executionId, conversationId, step, input, projectPath, attachments, userId)
  }

  async executeSequential(context: ExecutionContext, userInput: string): Promise<void> {
    return executeSequential(this.deps, context, userInput)
  }

  async executeDAG(context: ExecutionContext, userInput: string): Promise<void> {
    return executeDAGWorkflow(this.deps, context, userInput)
  }

  async executeStepByStep(context: ExecutionContext, userInput: string, stepIndex: number): Promise<void> {
    return executeStepByStep(this.deps, context, userInput, stepIndex)
  }

  async resumeExecution(context: ExecutionContext, userAnswer: string, pausedInfo: PausedExecutionInfo): Promise<void> {
    return resumeExecution(this.deps, context, userAnswer, pausedInfo)
  }

  async getPausedExecution(conversationId: string): Promise<PausedExecutionInfo | null> {
    return executionStateManager.getPausedExecution(conversationId)
  }

  cancel(conversationId: string): boolean {
    this.activeExecutions.delete(conversationId)
    const killed = this.engine.cancel(conversationId)

    sessionManager.deleteAllSessions(conversationId).catch(() => {})

    executionStateManager.getPausedExecution(conversationId).then(paused => {
      if (paused) {
        executionStateManager.markCancelled(paused.executionId).catch(() => {})
      }
    }).catch(() => {})

    return killed
  }

  interruptExecution(conversationId: string, userMessage: string): boolean {
    if (!this.activeExecutions.get(conversationId)) return false
    return this.engine.interrupt(conversationId, userMessage)
  }

  isExecuting(conversationId: string): boolean {
    return this.activeExecutions.get(conversationId) === true
  }

  getActiveCount(): number {
    return this.activeExecutions.size
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.on(event, handler)
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.off(event, handler)
  }
}

export const taskOrchestrator = new TaskOrchestrator()
