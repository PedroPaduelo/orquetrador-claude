import { prisma } from '../../../lib/prisma.js'
import { defaultEngine, type CliEngine } from '../engine/index.js'
import { sessionManager } from '../session/session-manager.js'
import { memoryManager } from '../memory/memory-manager.js'
import { conditionsEvaluator, type StepConditions } from './conditions-evaluator.js'
import { executionStateManager } from './execution-state.js'
import { orchestratorEvents } from './events.js'
import { fileSyncService } from '../file-sync/file-sync-service.js'
import { ExecutionMonitor } from '../monitoring/execution-monitor.js'
import { buildSystemPrompt } from '../engine/base-system-prompt.js'
import { DAGExecutor } from './dag-executor.js'
import { runValidators } from '../validators/validator-runner.js'
import type { ValidatorConfig } from '../validators/types.js'
import { webhooksService } from '../../webhooks/webhooks.service.js'
import { decideOnError, getStepTimeout, isStepError, getErrorMessage, resolveErrorHandler, FALLBACK_MESSAGE } from './step-error-handler.js'
import { execSync } from 'child_process'
import type { Prisma, WorkflowStep } from '@prisma/client'
import type { EngineExecuteResult } from '../engine/types.js'
import type { PausedExecutionInfo } from './execution-state.js'
import { createOrUpdateAggregate } from '../monitoring/execution-aggregate.service.js'
import { extractToolCallsForExecution } from '../monitoring/tool-call-extractor.js'

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
}

export class TaskOrchestrator {
  private activeExecutions = new Map<string, boolean>()
  private engine: CliEngine

  constructor(engine?: CliEngine) {
    this.engine = engine || defaultEngine
  }

  private finalizeExecution(executionId: string, conversationId: string) {
    // Fire-and-forget: extract tool calls and build aggregate
    Promise.all([
      extractToolCallsForExecution(executionId),
      createOrUpdateAggregate(executionId, conversationId),
    ]).catch(err => {
      console.error('[Orchestrator] Failed to finalize execution metrics:', err.message)
    })
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, stepName: string): Promise<T> {
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

  private isPromptTooLongError(error: string | undefined): boolean {
    if (!error) return false
    const lower = error.toLowerCase()
    return lower.includes('prompt is too long') || lower.includes('prompt_too_long')
  }

  private isSessionNotFoundError(error: string | undefined): boolean {
    if (!error) return false
    const lower = error.toLowerCase()
    return lower.includes('no conversation found with session id') || lower.includes('session not found') || lower.includes('session_not_found')
  }

  private evaluateSkipCondition(condition: string, input: string, stepIndex: number): boolean {
    try {
      // Simple expression evaluator for skip conditions
      // Supports: "empty_input", "step_index > N", "contains:keyword", "true", "false"
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

  private backoffDelay(attempt: number): Promise<void> {
    // Exponential backoff: 2^attempt * 1000ms, capped at 30s
    const ms = Math.min(Math.pow(2, attempt) * 1000, 30000)
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async executeStep(
    executionId: string,
    conversationId: string,
    step: WorkflowStep,
    input: string,
    projectPath: string,
    attachments?: MessageAttachment[],
    userId?: string,
  ) {
    // Get session (resume token) for this step
    let resumeToken = await sessionManager.getSession(conversationId, step.id)

    // Load memory for this step (accumulated context from previous compactions)
    const stepMemory = await memoryManager.getMemory(conversationId, step.id)

    const systemPrompt = buildSystemPrompt({
      stepSystemPrompt: step.systemPrompt,
      projectPath,
      memory: stepMemory,
      useBasePrompt: step.useBasePrompt !== false,
    })

    // Create monitor for this execution
    const monitor = new ExecutionMonitor(executionId, conversationId, step.id)
    if (userId) monitor.setUserId(userId)
    monitor.setInputMetadata({
      messageLength: input.length,
      systemPrompt,
      resumeToken,
      model: step.model || null,
      projectPath,
    })

    // Sync files (skills, agents, .mcp.json) for this step
    if (projectPath) {
      try {
        await fileSyncService.syncForStep(projectPath, step.id)
      } catch (syncError) {
        console.error(`[Orchestrator] File sync failed for step ${step.id}:`, syncError)
        // Continue execution even if sync fails - base MCP servers may still work
      }
    }

    // Fetch GitHub token from user and configure git in workspace
    // Priority: ProjectGitMapping (per-project account) > user.githubToken (legacy)
    let githubToken: string | undefined
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })

        // Check if this project has a specific git account mapped
        if (projectPath) {
          const mapping = await prisma.projectGitMapping.findUnique({
            where: { projectPath },
            include: { gitAccount: { select: { token: true, userId: true } } },
          })
          if (mapping && mapping.gitAccount.userId === userId) {
            githubToken = mapping.gitAccount.token
          }
        }

        // Fallback: use the user's first GitAccount if no project mapping
        if (!githubToken) {
          const defaultAccount = await prisma.gitAccount.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: { token: true },
          })
          githubToken = defaultAccount?.token ?? undefined
        }

        if (githubToken && projectPath) {
          try {
            const gitCheck = execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }).trim()
            if (gitCheck === 'true') {
              const userName = user?.name || 'Serendipd'
              const userEmail = user?.email || 'serendipd@execut.ai'
              execSync(`git config user.name "${userName.replace(/"/g, '\\"')}"`, { cwd: projectPath, timeout: 5000 })
              execSync(`git config user.email "${userEmail.replace(/"/g, '\\"')}"`, { cwd: projectPath, timeout: 5000 })
            }
          } catch { /* not a git repo, ignore */ }
        }
      } catch (err) {
        console.error(`[Orchestrator] Failed to fetch GitHub token for user ${userId}:`, err)
      }
    }

    const makeOnEvent = (mon: ExecutionMonitor) => (event: import('../engine/claude/stream-parser.js').StreamEvent) => {
      mon.onParsedEvent(event)
      if (event.type === 'content' && event.content) {
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'content',
          content: event.content,
        })
      } else if (event.type === 'action' && event.action) {
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: event.action,
        })
      } else if (event.type === 'metadata' && event.metadata?.mcp_servers) {
        // Emit MCP server status as a system action so the frontend can show it
        const failed = event.metadata.mcp_servers.filter(s => s.status !== 'connected')
        const connected = event.metadata.mcp_servers.filter(s => s.status === 'connected')
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: {
            type: 'system',
            content: `MCP Servers: ${connected.length} conectados${failed.length > 0 ? `, ${failed.length} falharam (${failed.map(s => s.name).join(', ')})` : ''}`,
          },
        })
      }
    }

    let currentMessage = input
    let currentAttachments = attachments
    let currentMonitor = monitor

    const stepTimeoutMs = getStepTimeout(step)

    // Loop to handle user interrupts — when the user sends a message mid-execution,
    // we kill the process and re-execute with --resume passing the user's message
    while (true) {
      let result: EngineExecuteResult
      try {
        result = await this.withTimeout(
          this.engine.execute({
            conversationId,
            stepId: step.id,
            message: currentMessage,
            systemPrompt,
            apiBaseUrl: step.baseUrl,
            projectPath,
            model: step.model || undefined,
            attachments: currentAttachments,
            resumeToken,
            githubToken,
            onEvent: makeOnEvent(currentMonitor),
            onRawStdout: (chunk) => currentMonitor.onStdout(chunk),
            onRawStderr: (chunk) => currentMonitor.onStderr(chunk),
          }),
          stepTimeoutMs,
          step.name,
        )
      } catch (timeoutErr) {
        // Timeout: kill process and return error result
        this.engine.cancel(conversationId)
        result = {
          content: '',
          resumeToken: null,
          actions: [],
          timedOut: true,
          cancelled: false,
          needsUserInput: false,
          exitCode: null,
          signal: null,
          error: (timeoutErr as Error).message,
        }
      }

      // Handle user interrupt: kill → save → resume with user message
      if (result.interrupted && result.interruptMessage) {
        // Flush trace for the interrupted execution
        currentMonitor.flush({
          exitCode: result.exitCode,
          signal: result.signal,
          resultStatus: 'interrupted',
          errorMessage: undefined,
          contentLength: result.content.length,
          actionsCount: result.actions.length,
          resumeTokenOut: result.resumeToken,
        })

        // Save the partial assistant content if any
        if (result.content) {
          const partialMsg = await prisma.message.create({
            data: {
              conversationId,
              stepId: step.id,
              role: 'assistant',
              content: result.content,
              metadata: {
                actions: result.actions,
                sessionId: result.resumeToken,
                stepName: step.name,
                interrupted: true,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          orchestratorEvents.emitMessageSaved({
            executionId,
            conversationId,
            messageId: partialMsg.id,
            role: 'assistant',
            content: result.content,
            stepId: step.id,
            stepName: step.name,
            metadata: { sessionId: result.resumeToken, interrupted: true, actions: result.actions },
          })
        }

        // Save user interrupt message to DB
        const userMsg = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'user',
            content: result.interruptMessage,
          },
        })
        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: userMsg.id,
          role: 'user',
          content: result.interruptMessage,
          stepId: step.id,
          stepName: step.name,
        })

        orchestratorEvents.emitUserInterrupt({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          userMessage: result.interruptMessage,
        })

        // Save session token for resume
        if (result.resumeToken) {
          await sessionManager.saveSession(conversationId, step.id, result.resumeToken)
          resumeToken = result.resumeToken
        }

        // Prepare for re-execution with user's message
        currentMessage = result.interruptMessage
        currentAttachments = undefined // no attachments on interrupt
        currentMonitor = new ExecutionMonitor(executionId, conversationId, step.id)
        if (userId) currentMonitor.setUserId(userId)
        currentMonitor.setInputMetadata({
          messageLength: currentMessage.length,
          systemPrompt,
          resumeToken,
          model: step.model || null,
          projectPath,
        })

        // Reset streaming content on frontend
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: {
            type: 'system',
            content: `Mensagem recebida, incorporando no fluxo...`,
          },
        })

        continue // Re-execute with --resume + user message
      }

      // If session expired/not found on Claude CLI side, clear it and retry without --resume
      if (this.isSessionNotFoundError(result.error) && resumeToken) {
        console.warn(`[Orchestrator] Session ${resumeToken} expired/not found. Clearing and retrying without resume.`)

        currentMonitor.flush({
          exitCode: result.exitCode,
          signal: result.signal,
          resultStatus: 'session_expired',
          errorMessage: result.error,
          contentLength: result.content.length,
          actionsCount: result.actions.length,
          resumeTokenOut: null,
        })

        await sessionManager.deleteSession(conversationId, step.id)
        resumeToken = null

        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: {
            type: 'system',
            content: '🔄 Sessão anterior expirou. Reiniciando com nova sessão...',
          },
        })

        continue // Re-execute without --resume
      }

      // If "Prompt is too long" and we were resuming a session, retry with a fresh session
      if (this.isPromptTooLongError(result.error) && resumeToken) {
        // Flush the failed trace first
        currentMonitor.flush({
          exitCode: result.exitCode,
          signal: result.signal,
          resultStatus: 'error',
          errorMessage: result.error,
          contentLength: result.content.length,
          actionsCount: result.actions.length,
          resumeTokenOut: result.resumeToken,
        })

        // MEMÓRIA: Resumir a conversa antes de compactar
        orchestratorEvents.emitStepStream({
          executionId,
          conversationId,
          stepId: step.id,
          type: 'action',
          action: {
            type: 'system',
            content: '💾 Salvando memória do contexto...',
          },
        })

        let memorySaved = false
        try {
          await memoryManager.summarizeAndSave(conversationId, step.id)
          memorySaved = true
        } catch (memErr) {
          console.error(`[Orchestrator] Erro ao salvar memória do step ${step.id}:`, memErr)
        }

        // Notify the frontend that we are resetting the context
        const resetReason = memorySaved
          ? '🔄 O contexto ficou muito longo e foi compactado. A memória do que foi feito foi salva automaticamente — a IA vai continuar de onde parou, sem perder o progresso.'
          : '🔄 O contexto ficou muito longo e foi compactado. A sessão será reiniciada. Pode ser necessário re-contextualizar o que estava sendo feito.'

        orchestratorEvents.emitContextReset({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          reason: resetReason,
        })

        // Delete the old session so we start fresh
        await sessionManager.deleteSession(conversationId, step.id)
        resumeToken = null

        // Load the freshly saved memory to inject into the new session
        const freshMemory = await memoryManager.getMemory(conversationId, step.id)
        const retrySystemPrompt = buildSystemPrompt({
          stepSystemPrompt: step.systemPrompt,
          projectPath,
          memory: freshMemory,
          useBasePrompt: step.useBasePrompt !== false,
        })

        // Create a new monitor for the retry
        const retryMonitor = new ExecutionMonitor(executionId, conversationId, step.id)
        if (userId) retryMonitor.setUserId(userId)
        retryMonitor.setInputMetadata({
          messageLength: currentMessage.length,
          systemPrompt: retrySystemPrompt,
          resumeToken: null,
          model: step.model || null,
          projectPath,
        })

        const retryResult = await this.engine.execute({
          conversationId,
          stepId: step.id,
          message: currentMessage,
          systemPrompt: retrySystemPrompt,
          apiBaseUrl: step.baseUrl,
          projectPath,
          model: step.model || undefined,
          attachments: currentAttachments,
          resumeToken: null,
          githubToken,
          onEvent: makeOnEvent(retryMonitor),
          onRawStdout: (chunk) => retryMonitor.onStdout(chunk),
          onRawStderr: (chunk) => retryMonitor.onStderr(chunk),
        })

        if (retryResult.resumeToken) {
          await sessionManager.saveSession(conversationId, step.id, retryResult.resumeToken)
        }

        let retryStatus = 'success'
        if (retryResult.error) retryStatus = 'error'
        else if (retryResult.timedOut) retryStatus = 'timeout'
        else if (retryResult.cancelled) retryStatus = 'cancelled'
        else if (retryResult.needsUserInput) retryStatus = 'needs_input'

        retryMonitor.flush({
          exitCode: retryResult.exitCode,
          signal: retryResult.signal,
          resultStatus: retryStatus,
          errorMessage: retryResult.error,
          contentLength: retryResult.content.length,
          actionsCount: retryResult.actions.length,
          resumeTokenOut: retryResult.resumeToken,
        })

        return retryResult
      }

      // Save session if we got a new one
      if (result.resumeToken) {
        await sessionManager.saveSession(conversationId, step.id, result.resumeToken)
      }

      // Determine status for monitoring
      let resultStatus = 'success'
      if (result.error) resultStatus = 'error'
      else if (result.timedOut) resultStatus = 'timeout'
      else if (result.cancelled) resultStatus = 'cancelled'
      else if (result.needsUserInput) resultStatus = 'needs_input'

      // Flush trace (fire-and-forget)
      currentMonitor.flush({
        exitCode: result.exitCode,
        signal: result.signal,
        resultStatus,
        errorMessage: result.error,
        contentLength: result.content.length,
        actionsCount: result.actions.length,
        resumeTokenOut: result.resumeToken,
      })

      return result
    }
  }

  async executeSequential(context: ExecutionContext, userInput: string): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

    const startIndex = 0
    const executionState = await executionStateManager.create(conversationId, startIndex)
    const executionId = executionState.id

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: steps[startIndex]?.id,
        role: 'user',
        content: userInput,
        ...(attachments && attachments.length > 0 ? {
          attachments: {
            create: attachments.map(att => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size || 0,
              path: att.path,
              projectPath: att.projectPath,
              url: att.url,
            })),
          },
        } : {}),
      },
      include: { attachments: true },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      conversationId,
      messageId: userMessage.id,
      role: 'user',
      content: userInput,
      stepId: steps[startIndex]?.id,
      stepName: steps[startIndex]?.name,
      attachments: userMessage.attachments,
    })

    let currentInput = userInput
    let retryCounts: Record<string, number> = {}

    try {
      let i = 0
      while (i < steps.length) {
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const step = steps[i]

        // Evaluate skipCondition before executing
        if (step.skipCondition) {
          const shouldSkip = this.evaluateSkipCondition(step.skipCondition, currentInput, i)
          if (shouldSkip) {
            await executionStateManager.logEvent(
              executionId, conversationId, 'step_skipped',
              { reason: 'skipCondition', condition: step.skipCondition },
              step.id, step.name,
            )
            orchestratorEvents.emitStepStream({
              executionId, conversationId, stepId: step.id,
              type: 'action',
              action: { type: 'system', content: `Step "${step.name}" pulado (condição: ${step.skipCondition})` },
            })
            i++
            continue
          }
        }

        await executionStateManager.updateStepIndex(executionId, i)

        await executionStateManager.logEvent(
          executionId,
          conversationId,
          'step_start',
          { stepOrder: i + 1, totalSteps: steps.length },
          step.id,
          step.name
        )

        orchestratorEvents.emitStepStart({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          stepOrder: i + 1,
          totalSteps: steps.length,
        })

        let result = await this.executeStep(
          executionId,
          conversationId,
          step,
          currentInput,
          projectPath,
          i === 0 ? attachments : undefined,
          userId,
        )

        if (result.cancelled || !this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          this.activeExecutions.delete(conversationId)
          return
        }

        // PAUSE: when Claude needs user input, save state and stop
        if (result.needsUserInput) {
          // Extract AskUserQuestion details from actions
          let askQuestion: PausedExecutionInfo['askUserQuestion'] | undefined
          for (const action of result.actions) {
            if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
              const input = action.input as Record<string, unknown>
              const questions = input.questions as Array<Record<string, unknown>> | undefined
              if (questions && questions.length > 0) {
                const q = questions[0]
                askQuestion = {
                  question: q.question as string,
                  options: (q.options as Array<{ label: string; description?: string }>) || undefined,
                }
              }
            }
          }

          // Save assistant content so far
          if (result.content) {
            const assistantMessage = await prisma.message.create({
              data: {
                conversationId,
                stepId: step.id,
                role: 'assistant',
                content: result.content,
                metadata: {
                  actions: result.actions,
                  sessionId: result.resumeToken,
                  stepName: step.name,
                  stepOrder: i + 1,
                  needsUserInput: true,
                } as unknown as Prisma.InputJsonValue,
              },
            })

            orchestratorEvents.emitMessageSaved({
              executionId,
              conversationId,
              messageId: assistantMessage.id,
              role: 'assistant',
              content: result.content,
              stepId: step.id,
              stepName: step.name,
              metadata: { sessionId: result.resumeToken, needsUserInput: true, actions: result.actions },
            })
          }

          await executionStateManager.markPaused(
            executionId,
            i,
            step.id,
            result.resumeToken,
            askQuestion,
          )

          orchestratorEvents.emitExecutionPaused({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            resumeToken: result.resumeToken,
            askUserQuestion: askQuestion,
          })

          this.activeExecutions.delete(conversationId)
          return
        }

        if (isStepError(result)) {
          const decision = decideOnError(step, result)
          const errMsg = getErrorMessage(result)
          console.warn(decision.logMessage)

          orchestratorEvents.emitStepError({
            executionId, conversationId,
            stepId: step.id, stepName: step.name,
            error: `[${decision.action}] ${errMsg}`,
          })

          if (decision.action === 'fail') {
            await executionStateManager.markFailed(executionId, errMsg)
            this.activeExecutions.delete(conversationId)
            return
          }

          if (decision.action === 'fallback') {
            const fbResult = await this.executeStep(
              executionId, conversationId, step,
              FALLBACK_MESSAGE, projectPath, undefined, userId,
            )
            if (isStepError(fbResult)) {
              await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
              this.activeExecutions.delete(conversationId)
              return
            }
            result = fbResult
          }

          if (decision.skipStep) {
            await executionStateManager.logEvent(
              executionId, conversationId, 'step_skipped',
              { error: errMsg, handler: 'skip' }, step.id, step.name,
            )
            i++
            continue
          }
          // continue_next: fall through, treat error result as success
        }

        // Run validators if configured
        const validatorConfigs = (step.validators || []) as unknown as ValidatorConfig[]

        if (validatorConfigs.length > 0) {
          const validation = await runValidators(validatorConfigs, result.content, projectPath)
          if (!validation.allPassed) {
            const failedResult = validation.results.find(r => !r.valid)
            const feedback = failedResult?.feedback || failedResult?.details || failedResult?.message || 'Validation failed'
            orchestratorEvents.emitValidationFailed({
              executionId,
              conversationId,
              stepId: step.id,
              stepName: step.name,
              validatorType: failedResult?.type || 'unknown',
              feedback,
            })
            // Retry: re-run same step with feedback
            const currentRetry = (retryCounts[`validator_${step.id}`] || 0) + 1
            const maxRetries = step.maxRetries || 2
            if (currentRetry < maxRetries) {
              retryCounts[`validator_${step.id}`] = currentRetry
              await this.backoffDelay(currentRetry)
              currentInput = `A validacao falhou: ${feedback}\n\nPor favor corrija e tente novamente. Output anterior:\n${result.content}`
              continue
            }
            delete retryCounts[`validator_${step.id}`]
          }
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: {
              actions: result.actions,
              sessionId: result.resumeToken,
              stepName: step.name,
              stepOrder: i + 1,
            } as unknown as Prisma.InputJsonValue,
          },
        })

        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, actions: result.actions },
        })

        // Save checkpoint after each successful step
        await executionStateManager.saveCheckpoint(executionId, i, result.content, result.content).catch(() => {})

        const conditions = (step.conditions || { rules: [], default: 'continue' }) as unknown as StepConditions
        const conditionResult = conditionsEvaluator.evaluate(result.content, conditions)

        const nextStep = conditionsEvaluator.resolveNextStep(
          conditionResult.action,
          steps.map((s) => ({ id: s.id, name: s.name })),
          i
        )

        if (nextStep.isRetry) {
          const currentRetry = (retryCounts[step.id] || 0) + 1
          const maxRetries = conditionResult.rule?.maxRetries || step.maxRetries || 3

          if (currentRetry >= maxRetries) {
            orchestratorEvents.emitStepComplete({
              executionId,
              conversationId,
              stepId: step.id,
              stepName: step.name,
              stepOrder: i + 1,
              content: result.content,
              sessionId: result.resumeToken || undefined,
              finished: false,
            })

            delete retryCounts[step.id]
            i++
            currentInput = result.content
          } else {
            retryCounts[step.id] = currentRetry
            await executionStateManager.updateRetryCounts(executionId, retryCounts)

            const retryMessage = conditionsEvaluator.formatRetryMessage(
              conditionResult.rule?.retryMessage,
              result.content,
              conditionResult.rule!
            )

            orchestratorEvents.emitConditionRetry({
              executionId,
              conversationId,
              stepId: step.id,
              retryCount: currentRetry,
              maxRetries,
              retryMessage,
            })

            await this.backoffDelay(currentRetry)
            currentInput = retryMessage
          }
        } else if (nextStep.isFinished) {
          orchestratorEvents.emitStepComplete({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.resumeToken || undefined,
            finished: true,
          })
          break
        } else {
          orchestratorEvents.emitStepComplete({
            executionId,
            conversationId,
            stepId: step.id,
            stepName: step.name,
            stepOrder: i + 1,
            content: result.content,
            sessionId: result.resumeToken || undefined,
            finished: nextStep.nextIndex >= steps.length,
          })

          if (nextStep.nextIndex < i && conditionResult.matched && conditionResult.rule) {
            const jumpKey = `jump_${step.id}_to_${nextStep.nextIndex}`
            const currentRetry = (retryCounts[jumpKey] || 0) + 1
            const maxRetries = conditionResult.rule.maxRetries || 3

            if (currentRetry >= maxRetries) {
              delete retryCounts[jumpKey]
              i = i + 1
              currentInput = result.content
            } else {
              retryCounts[jumpKey] = currentRetry
              await executionStateManager.updateRetryCounts(executionId, retryCounts)

              const retryMessage = conditionsEvaluator.formatRetryMessage(
                conditionResult.rule.retryMessage,
                result.content,
                conditionResult.rule
              )

              orchestratorEvents.emitConditionJump({
                executionId,
                conversationId,
                fromStepId: step.id,
                toStepId: steps[nextStep.nextIndex]?.id || 'end',
                toStepIndex: nextStep.nextIndex,
              })

              await this.backoffDelay(currentRetry)
              i = nextStep.nextIndex
              currentInput = retryMessage
            }
          } else {
            const keysToDelete = Object.keys(retryCounts).filter(k => k.startsWith(`jump_${step.id}`))
            keysToDelete.forEach(k => delete retryCounts[k])

            if (nextStep.nextIndex !== i + 1) {
              orchestratorEvents.emitConditionJump({
                executionId,
                conversationId,
                fromStepId: step.id,
                toStepId: steps[nextStep.nextIndex]?.id || 'end',
                toStepIndex: nextStep.nextIndex,
              })
            }

            i = nextStep.nextIndex
            currentInput = result.content
          }
        }
      }

      await executionStateManager.markCompleted(executionId)
      this.finalizeExecution(executionId, conversationId)
      orchestratorEvents.emitExecutionComplete({
        executionId,
        conversationId,
        success: true,
      })

      // Dispatch webhook
      if (userId) {
        webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      this.finalizeExecution(executionId, conversationId)
      // Dispatch error webhook
      if (userId) {
        webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
      }
      throw error
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  async executeDAG(context: ExecutionContext, userInput: string): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

    const executionState = await executionStateManager.create(conversationId, 0)
    const executionId = executionState.id

    const dag = new DAGExecutor(steps)
    const validation = dag.validate()
    if (!validation.valid) {
      await executionStateManager.markFailed(executionId, validation.error || 'Invalid DAG')
      this.activeExecutions.delete(conversationId)
      throw new Error(validation.error || 'Invalid DAG')
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: steps[0]?.id,
        role: 'user',
        content: userInput,
        ...(attachments && attachments.length > 0 ? {
          attachments: {
            create: attachments.map(att => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size || 0,
              path: att.path,
              projectPath: att.projectPath,
              url: att.url,
            })),
          },
        } : {}),
      },
      include: { attachments: true },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      conversationId,
      messageId: userMessage.id,
      role: 'user',
      content: userInput,
      stepId: steps[0]?.id,
      stepName: steps[0]?.name,
      attachments: userMessage.attachments,
    })

    try {
      let batchIndex = 0
      while (!dag.isComplete()) {
        if (!this.activeExecutions.get(conversationId)) {
          orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
          await executionStateManager.markCancelled(executionId)
          return
        }

        const readySteps = dag.getReadySteps()
        if (readySteps.length === 0) break

        orchestratorEvents.emitDagBatchStart({
          executionId,
          conversationId,
          stepIds: readySteps.map(s => s.step.id),
          batchIndex,
        })

        // Execute ready steps in parallel
        const results = await Promise.all(
          readySteps.map(async (dagStep) => {
            const depContext = dag.getDependencyContext(dagStep.step.id)
            const input = depContext ? `${userInput}\n\n${depContext}` : userInput

            orchestratorEvents.emitStepStart({
              executionId,
              conversationId,
              stepId: dagStep.step.id,
              stepName: dagStep.step.name,
              stepOrder: dagStep.index + 1,
              totalSteps: dag.totalSteps,
            })

            let result = await this.executeStep(
              executionId,
              conversationId,
              dagStep.step,
              input,
              projectPath,
              dagStep.index === 0 ? attachments : undefined,
              userId,
            )

            if (isStepError(result)) {
              const decision = decideOnError(dagStep.step, result)
              const errMsg = getErrorMessage(result)
              console.warn(decision.logMessage)

              orchestratorEvents.emitStepError({
                executionId, conversationId,
                stepId: dagStep.step.id, stepName: dagStep.step.name,
                error: `[${decision.action}] ${errMsg}`,
              })

              if (decision.action === 'fallback') {
                const fbResult = await this.executeStep(
                  executionId, conversationId, dagStep.step,
                  FALLBACK_MESSAGE, projectPath, undefined, userId,
                )
                if (!isStepError(fbResult)) {
                  result = fbResult
                }
              }
            }

            if (!isStepError(result) || resolveErrorHandler(dagStep.step) !== 'fail') {
              // Save assistant message (for success or non-fail handlers)
              const msg = await prisma.message.create({
                data: {
                  conversationId,
                  stepId: dagStep.step.id,
                  role: 'assistant',
                  content: result.content,
                  metadata: {
                    actions: result.actions,
                    sessionId: result.resumeToken,
                    stepName: dagStep.step.name,
                    stepOrder: dagStep.index + 1,
                  } as unknown as Prisma.InputJsonValue,
                },
              })
              orchestratorEvents.emitMessageSaved({
                executionId,
                conversationId,
                messageId: msg.id,
                role: 'assistant',
                content: result.content,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
              })

              orchestratorEvents.emitStepComplete({
                executionId,
                conversationId,
                stepId: dagStep.step.id,
                stepName: dagStep.step.name,
                stepOrder: dagStep.index + 1,
                content: result.content,
                sessionId: result.resumeToken || undefined,
                finished: false,
              })
            }

            return { dagStep, result }
          })
        )

        // Mark completed and check for errors
        for (const { dagStep, result } of results) {
          if (isStepError(result)) {
            const handler = resolveErrorHandler(dagStep.step)
            if (handler === 'fail') {
              await executionStateManager.markFailed(executionId, getErrorMessage(result))
              this.activeExecutions.delete(conversationId)
              return
            }
            dag.markCompleted(dagStep.step.id, result.content || '')
          } else {
            dag.markCompleted(dagStep.step.id, result.content)
          }
        }

        batchIndex++
      }

      await executionStateManager.markCompleted(executionId)
      this.finalizeExecution(executionId, conversationId)
      orchestratorEvents.emitExecutionComplete({ executionId, conversationId, success: true })

      if (userId) {
        webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      this.finalizeExecution(executionId, conversationId)
      if (userId) {
        webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
      }
      throw error
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  async executeStepByStep(
    context: ExecutionContext,
    userInput: string,
    stepIndex: number
  ): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context

    if (stepIndex >= steps.length) {
      throw new Error('Step index out of bounds')
    }

    const step = steps[stepIndex]

    const executionState = await executionStateManager.create(conversationId, stepIndex)
    const executionId = executionState.id

    // Log step start
    await executionStateManager.logEvent(
      executionId,
      conversationId,
      'step_start',
      { stepOrder: stepIndex + 1, totalSteps: steps.length },
      step.id,
      step.name
    )

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: step.id,
        role: 'user',
        content: userInput,
        ...(attachments && attachments.length > 0 ? {
          attachments: {
            create: attachments.map(att => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size || 0,
              path: att.path,
              projectPath: att.projectPath,
              url: att.url,
            })),
          },
        } : {}),
      },
      include: { attachments: true },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      conversationId,
      messageId: userMessage.id,
      role: 'user',
      content: userInput,
      stepId: step.id,
      stepName: step.name,
      attachments: userMessage.attachments,
    })

    orchestratorEvents.emitStepStart({
      executionId,
      conversationId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: stepIndex + 1,
      totalSteps: steps.length,
    })

    try {
      let result = await this.executeStep(
        executionId,
        conversationId,
        step,
        userInput,
        projectPath,
        attachments,
        userId,
      )

      if (isStepError(result)) {
        const decision = decideOnError(step, result)
        const errMsg = getErrorMessage(result)
        console.warn(decision.logMessage)
        await executionStateManager.logEvent(
          executionId, conversationId, 'step_error',
          { error: errMsg, handler: decision.action, stepOrder: stepIndex + 1 },
          step.id, step.name,
        )
        orchestratorEvents.emitStepError({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          error: `[${decision.action}] ${errMsg}`,
        })
        if (decision.action === 'fail') {
          await executionStateManager.markFailed(executionId, errMsg)
          return
        }
        if (decision.action === 'fallback') {
          const fbResult = await this.executeStep(
            executionId, conversationId, step,
            FALLBACK_MESSAGE, projectPath, undefined, userId,
          )
          if (isStepError(fbResult)) {
            await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
            return
          }
          result = fbResult
        }
        // skip and continue_next: fall through to complete
      }

      // PAUSE: when Claude needs user input, save state and stop
      if (result.needsUserInput) {
        let askQuestion: PausedExecutionInfo['askUserQuestion'] | undefined
        for (const action of result.actions) {
          if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
            const input = action.input as Record<string, unknown>
            const questions = input.questions as Array<Record<string, unknown>> | undefined
            if (questions && questions.length > 0) {
              const q = questions[0]
              askQuestion = {
                question: q.question as string,
                options: (q.options as Array<{ label: string; description?: string }>) || undefined,
              }
            }
          }
        }

        if (result.content) {
          const assistantMessage = await prisma.message.create({
            data: {
              conversationId,
              stepId: step.id,
              role: 'assistant',
              content: result.content,
              metadata: {
                actions: result.actions,
                sessionId: result.resumeToken,
                stepName: step.name,
                stepOrder: stepIndex + 1,
                needsUserInput: true,
              } as unknown as Prisma.InputJsonValue,
            },
          })

          orchestratorEvents.emitMessageSaved({
            executionId,
            conversationId,
            messageId: assistantMessage.id,
            role: 'assistant',
            content: result.content,
            stepId: step.id,
            stepName: step.name,
            metadata: { sessionId: result.resumeToken, needsUserInput: true, actions: result.actions },
          })
        }

        await executionStateManager.markPaused(
          executionId,
          stepIndex,
          step.id,
          result.resumeToken,
          askQuestion,
        )

        orchestratorEvents.emitExecutionPaused({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          stepOrder: stepIndex + 1,
          resumeToken: result.resumeToken,
          askUserQuestion: askQuestion,
        })
        return
      }

      if (result.content) {
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: {
              actions: result.actions,
              sessionId: result.resumeToken,
              stepName: step.name,
              stepOrder: stepIndex + 1,
            } as unknown as Prisma.InputJsonValue,
          },
        })

        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, actions: result.actions },
        })
      }

      await executionStateManager.logEvent(
        executionId,
        conversationId,
        'step_complete',
        {
          stepOrder: stepIndex + 1,
          contentLength: result.content.length,
          actionsCount: result.actions.length,
        },
        step.id,
        step.name
      )

      orchestratorEvents.emitStepComplete({
        executionId,
        conversationId,
        stepId: step.id,
        stepName: step.name,
        stepOrder: stepIndex + 1,
        content: result.content,
        sessionId: result.resumeToken || undefined,
        finished: false,
      })

      await executionStateManager.markCompleted(executionId)
      this.finalizeExecution(executionId, conversationId)
      orchestratorEvents.emitExecutionComplete({
        executionId,
        conversationId,
        success: true,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      this.finalizeExecution(executionId, conversationId)
      throw error
    }
  }

  /**
   * Resume a paused execution — continues from the same step using --resume token.
   * The user's answer is sent as the message, and Claude continues the existing session.
   */
  async resumeExecution(
    context: ExecutionContext,
    userAnswer: string,
    pausedInfo: PausedExecutionInfo,
  ): Promise<void> {
    const { conversationId, steps, projectPath, attachments, userId } = context
    const executionId = pausedInfo.executionId

    if (this.activeExecutions.get(conversationId)) {
      throw new Error('Execution already in progress for this conversation')
    }

    this.activeExecutions.set(conversationId, true)

    // Mark execution as running again
    await executionStateManager.resumeFromPaused(executionId)

    const stepIndex = pausedInfo.stepIndex
    const step = steps[stepIndex]
    if (!step) {
      await executionStateManager.markFailed(executionId, `Step index ${stepIndex} not found`)
      this.activeExecutions.delete(conversationId)
      return
    }

    // Save user's answer as a message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        stepId: step.id,
        role: 'user',
        content: userAnswer,
        ...(attachments && attachments.length > 0 ? {
          attachments: {
            create: attachments.map(att => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size || 0,
              path: att.path,
              projectPath: att.projectPath,
              url: att.url,
            })),
          },
        } : {}),
      },
      include: { attachments: true },
    })

    orchestratorEvents.emitMessageSaved({
      executionId,
      conversationId,
      messageId: userMessage.id,
      role: 'user',
      content: userAnswer,
      stepId: step.id,
      stepName: step.name,
      attachments: userMessage.attachments,
    })

    orchestratorEvents.emitExecutionResumed({
      executionId,
      conversationId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: stepIndex + 1,
    })

    orchestratorEvents.emitStepStart({
      executionId,
      conversationId,
      stepId: step.id,
      stepName: step.name,
      stepOrder: stepIndex + 1,
      totalSteps: steps.length,
    })

    try {
      // Execute the SAME step with --resume to continue the session
      let result = await this.executeStep(
        executionId,
        conversationId,
        step,
        userAnswer,
        projectPath,
        attachments,
        userId,
      )

      if (result.cancelled || !this.activeExecutions.get(conversationId)) {
        orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
        await executionStateManager.markCancelled(executionId)
        this.activeExecutions.delete(conversationId)
        return
      }

      // If it needs user input AGAIN, pause again
      if (result.needsUserInput) {
        let askQuestion: PausedExecutionInfo['askUserQuestion'] | undefined
        for (const action of result.actions) {
          if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
            const input = action.input as Record<string, unknown>
            const questions = input.questions as Array<Record<string, unknown>> | undefined
            if (questions && questions.length > 0) {
              const q = questions[0]
              askQuestion = {
                question: q.question as string,
                options: (q.options as Array<{ label: string; description?: string }>) || undefined,
              }
            }
          }
        }

        if (result.content) {
          const assistantMessage = await prisma.message.create({
            data: {
              conversationId,
              stepId: step.id,
              role: 'assistant',
              content: result.content,
              metadata: {
                actions: result.actions,
                sessionId: result.resumeToken,
                stepName: step.name,
                stepOrder: stepIndex + 1,
                needsUserInput: true,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          orchestratorEvents.emitMessageSaved({
            executionId,
            conversationId,
            messageId: assistantMessage.id,
            role: 'assistant',
            content: result.content,
            stepId: step.id,
            stepName: step.name,
            metadata: { sessionId: result.resumeToken, needsUserInput: true, actions: result.actions },
          })
        }

        await executionStateManager.markPaused(executionId, stepIndex, step.id, result.resumeToken, askQuestion)
        orchestratorEvents.emitExecutionPaused({
          executionId,
          conversationId,
          stepId: step.id,
          stepName: step.name,
          stepOrder: stepIndex + 1,
          resumeToken: result.resumeToken,
          askUserQuestion: askQuestion,
        })
        this.activeExecutions.delete(conversationId)
        return
      }

      if (isStepError(result)) {
        const decision = decideOnError(step, result)
        const errMsg = getErrorMessage(result)
        console.warn(decision.logMessage)
        orchestratorEvents.emitStepError({
          executionId, conversationId,
          stepId: step.id, stepName: step.name,
          error: `[${decision.action}] ${errMsg}`,
        })
        if (decision.action === 'fail') {
          await executionStateManager.markFailed(executionId, errMsg)
          this.activeExecutions.delete(conversationId)
          return
        }
        if (decision.action === 'fallback') {
          const fbResult = await this.executeStep(
            executionId, conversationId, step,
            FALLBACK_MESSAGE, projectPath, undefined, userId,
          )
          if (isStepError(fbResult)) {
            await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
            this.activeExecutions.delete(conversationId)
            return
          }
          result = fbResult
        }
        // skip and continue_next: fall through
      }

      // Save result
      if (result.content) {
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            stepId: step.id,
            role: 'assistant',
            content: result.content,
            metadata: {
              actions: result.actions,
              sessionId: result.resumeToken,
              stepName: step.name,
              stepOrder: stepIndex + 1,
            } as unknown as Prisma.InputJsonValue,
          },
        })
        orchestratorEvents.emitMessageSaved({
          executionId,
          conversationId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, actions: result.actions },
        })
      }

      orchestratorEvents.emitStepComplete({
        executionId,
        conversationId,
        stepId: step.id,
        stepName: step.name,
        stepOrder: stepIndex + 1,
        content: result.content,
        sessionId: result.resumeToken || undefined,
        finished: false,
      })

      await executionStateManager.saveCheckpoint(executionId, stepIndex, result.content, result.content).catch(() => {})

      // For sequential workflows: continue to next steps
      const isSequentialWorkflow = steps.length > 1 && context.workflowId
      if (isSequentialWorkflow) {
        let currentInput = result.content
        let retryCounts: Record<string, number> = {}

        for (let i = stepIndex + 1; i < steps.length; i++) {
          if (!this.activeExecutions.get(conversationId)) {
            orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
            await executionStateManager.markCancelled(executionId)
            return
          }

          const nextStep = steps[i]
          await executionStateManager.updateStepIndex(executionId, i)

          orchestratorEvents.emitStepStart({
            executionId,
            conversationId,
            stepId: nextStep.id,
            stepName: nextStep.name,
            stepOrder: i + 1,
            totalSteps: steps.length,
          })

          let nextResult = await this.executeStep(
            executionId,
            conversationId,
            nextStep,
            currentInput,
            projectPath,
            undefined,
            userId,
          )

          if (nextResult.cancelled || !this.activeExecutions.get(conversationId)) {
            orchestratorEvents.emitExecutionCancelled({ executionId, conversationId })
            await executionStateManager.markCancelled(executionId)
            this.activeExecutions.delete(conversationId)
            return
          }

          if (nextResult.needsUserInput) {
            let askQ: PausedExecutionInfo['askUserQuestion'] | undefined
            for (const action of nextResult.actions) {
              if (action.type === 'tool_use' && action.name === 'AskUserQuestion' && action.input) {
                const inp = action.input as Record<string, unknown>
                const questions = inp.questions as Array<Record<string, unknown>> | undefined
                if (questions && questions.length > 0) {
                  const q = questions[0]
                  askQ = {
                    question: q.question as string,
                    options: (q.options as Array<{ label: string; description?: string }>) || undefined,
                  }
                }
              }
            }

            if (nextResult.content) {
              const msg = await prisma.message.create({
                data: {
                  conversationId,
                  stepId: nextStep.id,
                  role: 'assistant',
                  content: nextResult.content,
                  metadata: {
                    actions: nextResult.actions,
                    sessionId: nextResult.resumeToken,
                    stepName: nextStep.name,
                    stepOrder: i + 1,
                    needsUserInput: true,
                  } as unknown as Prisma.InputJsonValue,
                },
              })
              orchestratorEvents.emitMessageSaved({
                executionId,
                conversationId,
                messageId: msg.id,
                role: 'assistant',
                content: nextResult.content,
                stepId: nextStep.id,
                stepName: nextStep.name,
              })
            }

            await executionStateManager.markPaused(executionId, i, nextStep.id, nextResult.resumeToken, askQ)
            orchestratorEvents.emitExecutionPaused({
              executionId,
              conversationId,
              stepId: nextStep.id,
              stepName: nextStep.name,
              stepOrder: i + 1,
              resumeToken: nextResult.resumeToken,
              askUserQuestion: askQ,
            })
            this.activeExecutions.delete(conversationId)
            return
          }

          if (isStepError(nextResult)) {
            const decision = decideOnError(nextStep, nextResult)
            const errMsg = getErrorMessage(nextResult)
            console.warn(decision.logMessage)
            orchestratorEvents.emitStepError({
              executionId, conversationId,
              stepId: nextStep.id, stepName: nextStep.name,
              error: `[${decision.action}] ${errMsg}`,
            })
            if (decision.action === 'fail') {
              await executionStateManager.markFailed(executionId, errMsg)
              this.activeExecutions.delete(conversationId)
              return
            }
            if (decision.action === 'fallback') {
              const fbResult = await this.executeStep(
                executionId, conversationId, nextStep,
                FALLBACK_MESSAGE, projectPath, undefined, userId,
              )
              if (isStepError(fbResult)) {
                await executionStateManager.markFailed(executionId, getErrorMessage(fbResult))
                this.activeExecutions.delete(conversationId)
                return
              }
              nextResult = fbResult
            }
            if (decision.skipStep) {
              continue
            }
            // continue_next: fall through
          }

          // Run validators
          const validatorConfigs = (nextStep.validators || []) as unknown as ValidatorConfig[]

          if (validatorConfigs.length > 0) {
            const validation = await runValidators(validatorConfigs, nextResult.content, projectPath)
            if (!validation.allPassed) {
              const failedResult = validation.results.find(r => !r.valid)
              const feedback = failedResult?.feedback || failedResult?.details || failedResult?.message || 'Validation failed'
              orchestratorEvents.emitValidationFailed({
                executionId,
                conversationId,
                stepId: nextStep.id,
                stepName: nextStep.name,
                validatorType: failedResult?.type || 'unknown',
                feedback,
              })
              const currentRetry = (retryCounts[`validator_${nextStep.id}`] || 0) + 1
              const maxRetries = nextStep.maxRetries || 2
              if (currentRetry < maxRetries) {
                retryCounts[`validator_${nextStep.id}`] = currentRetry
                currentInput = `A validacao falhou: ${feedback}\n\nPor favor corrija e tente novamente. Output anterior:\n${nextResult.content}`
                i-- // retry same step
                continue
              }
              delete retryCounts[`validator_${nextStep.id}`]
            }
          }

          const msg = await prisma.message.create({
            data: {
              conversationId,
              stepId: nextStep.id,
              role: 'assistant',
              content: nextResult.content,
              metadata: {
                actions: nextResult.actions,
                sessionId: nextResult.resumeToken,
                stepName: nextStep.name,
                stepOrder: i + 1,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          orchestratorEvents.emitMessageSaved({
            executionId,
            conversationId,
            messageId: msg.id,
            role: 'assistant',
            content: nextResult.content,
            stepId: nextStep.id,
            stepName: nextStep.name,
          })

          orchestratorEvents.emitStepComplete({
            executionId,
            conversationId,
            stepId: nextStep.id,
            stepName: nextStep.name,
            stepOrder: i + 1,
            content: nextResult.content,
            sessionId: nextResult.resumeToken || undefined,
            finished: i >= steps.length - 1,
          })

          await executionStateManager.saveCheckpoint(executionId, i, nextResult.content, nextResult.content).catch(() => {})
          currentInput = nextResult.content
        }
      }

      await executionStateManager.markCompleted(executionId)
      this.finalizeExecution(executionId, conversationId)
      orchestratorEvents.emitExecutionComplete({
        executionId,
        conversationId,
        success: true,
      })

      if (userId) {
        webhooksService.dispatch('execution:complete', { executionId, conversationId, success: true }, userId).catch(() => {})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await executionStateManager.markFailed(executionId, errorMessage)
      this.finalizeExecution(executionId, conversationId)
      if (userId) {
        webhooksService.dispatch('step:error', { executionId, conversationId, error: errorMessage }, userId).catch(() => {})
      }
      throw error
    } finally {
      this.activeExecutions.delete(conversationId)
    }
  }

  /**
   * Check if there's a paused execution for a conversation
   */
  async getPausedExecution(conversationId: string): Promise<PausedExecutionInfo | null> {
    return executionStateManager.getPausedExecution(conversationId)
  }

  cancel(conversationId: string): boolean {
    this.activeExecutions.delete(conversationId)
    const killed = this.engine.cancel(conversationId)

    // Only delete sessions on explicit cancel, not on pause
    sessionManager.deleteAllSessions(conversationId).catch(() => {})

    // Also cancel any paused executions
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

  on(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.on(event, handler)
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    orchestratorEvents.off(event, handler)
  }
}

export const taskOrchestrator = new TaskOrchestrator()
