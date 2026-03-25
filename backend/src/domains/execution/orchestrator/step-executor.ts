import { prisma } from '../../../lib/prisma.js'
import { sessionManager } from '../session/session-manager.js'
import { memoryManager } from '../memory/memory-manager.js'
import { orchestratorEvents } from './events.js'
import { fileSyncService } from '../file-sync/file-sync-service.js'
import { ExecutionMonitor } from '../monitoring/execution-monitor.js'
import { buildSystemPrompt } from '../engine/base-system-prompt.js'
import { getStepTimeout } from './step-error-handler.js'
import { execSync } from 'child_process'
import type { Prisma, WorkflowStep } from '@prisma/client'
import type { EngineExecuteResult } from '../engine/types.js'
import type { MessageAttachment, OrchestratorDeps } from './orchestrator-types.js'
import { withTimeout, isPromptTooLongError, isSessionNotFoundError } from './orchestrator-utils.js'

export async function executeStep(
  deps: OrchestratorDeps,
  executionId: string,
  conversationId: string,
  step: WorkflowStep,
  input: string,
  projectPath: string,
  attachments?: MessageAttachment[],
  userId?: string,
): Promise<EngineExecuteResult> {
  let resumeToken = await sessionManager.getSession(conversationId, step.id)
  const stepMemory = await memoryManager.getMemory(conversationId, step.id)

  const systemPrompt = buildSystemPrompt({
    stepSystemPrompt: step.systemPrompt,
    projectPath,
    memory: stepMemory,
    useBasePrompt: step.useBasePrompt !== false,
  })

  const monitor = new ExecutionMonitor(executionId, conversationId, step.id)
  if (userId) monitor.setUserId(userId)
  monitor.setInputMetadata({
    messageLength: input.length,
    systemPrompt,
    resumeToken,
    model: step.model || null,
    projectPath,
  })

  if (projectPath) {
    try {
      await fileSyncService.syncForStep(projectPath, step.id)
    } catch (syncError) {
      console.error(`[Orchestrator] File sync failed for step ${step.id}:`, syncError)
    }
  }

  // Fetch GitHub token from user and configure git in workspace
  let githubToken: string | undefined
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      })

      if (projectPath) {
        const mapping = await prisma.projectGitMapping.findUnique({
          where: { projectPath },
          include: { gitAccount: { select: { token: true, userId: true } } },
        })
        if (mapping && mapping.gitAccount.userId === userId) {
          githubToken = mapping.gitAccount.token
        }
      }

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
        executionId, conversationId, stepId: step.id,
        type: 'content', content: event.content,
      })
    } else if (event.type === 'action' && event.action) {
      orchestratorEvents.emitStepStream({
        executionId, conversationId, stepId: step.id,
        type: 'action', action: event.action,
      })
    } else if (event.type === 'metadata' && event.metadata?.mcp_servers) {
      const failed = event.metadata.mcp_servers.filter(s => s.status !== 'connected')
      const connected = event.metadata.mcp_servers.filter(s => s.status === 'connected')
      orchestratorEvents.emitStepStream({
        executionId, conversationId, stepId: step.id,
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

  while (true) {
    let result: EngineExecuteResult
    try {
      result = await withTimeout(
        deps.engine.execute({
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
      deps.engine.cancel(conversationId)
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
      currentMonitor.flush({
        exitCode: result.exitCode,
        signal: result.signal,
        resultStatus: 'interrupted',
        errorMessage: undefined,
        contentLength: result.content.length,
        actionsCount: result.actions.length,
        resumeTokenOut: result.resumeToken,
      })

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
          executionId, conversationId,
          messageId: partialMsg.id,
          role: 'assistant',
          content: result.content,
          stepId: step.id,
          stepName: step.name,
          metadata: { sessionId: result.resumeToken, interrupted: true, actions: result.actions },
        })
      }

      const userMsg = await prisma.message.create({
        data: {
          conversationId,
          stepId: step.id,
          role: 'user',
          content: result.interruptMessage,
        },
      })
      orchestratorEvents.emitMessageSaved({
        executionId, conversationId,
        messageId: userMsg.id,
        role: 'user',
        content: result.interruptMessage,
        stepId: step.id,
        stepName: step.name,
      })

      orchestratorEvents.emitUserInterrupt({
        executionId, conversationId,
        stepId: step.id,
        stepName: step.name,
        userMessage: result.interruptMessage,
      })

      if (result.resumeToken) {
        await sessionManager.saveSession(conversationId, step.id, result.resumeToken)
        resumeToken = result.resumeToken
      }

      currentMessage = result.interruptMessage
      currentAttachments = undefined
      currentMonitor = new ExecutionMonitor(executionId, conversationId, step.id)
      if (userId) currentMonitor.setUserId(userId)
      currentMonitor.setInputMetadata({
        messageLength: currentMessage.length,
        systemPrompt,
        resumeToken,
        model: step.model || null,
        projectPath,
      })

      orchestratorEvents.emitStepStream({
        executionId, conversationId, stepId: step.id,
        type: 'action',
        action: {
          type: 'system',
          content: `Mensagem recebida, incorporando no fluxo...`,
        },
      })

      continue
    }

    // If session expired/not found, clear and retry without --resume
    if (isSessionNotFoundError(result.error) && resumeToken) {
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
        executionId, conversationId, stepId: step.id,
        type: 'action',
        action: {
          type: 'system',
          content: '🔄 Sessão anterior expirou. Reiniciando com nova sessão...',
        },
      })

      continue
    }

    // If "Prompt is too long" and we were resuming, retry with fresh session
    if (isPromptTooLongError(result.error) && resumeToken) {
      currentMonitor.flush({
        exitCode: result.exitCode,
        signal: result.signal,
        resultStatus: 'error',
        errorMessage: result.error,
        contentLength: result.content.length,
        actionsCount: result.actions.length,
        resumeTokenOut: result.resumeToken,
      })

      orchestratorEvents.emitStepStream({
        executionId, conversationId, stepId: step.id,
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

      const resetReason = memorySaved
        ? '🔄 O contexto ficou muito longo e foi compactado. A memória do que foi feito foi salva automaticamente — a IA vai continuar de onde parou, sem perder o progresso.'
        : '🔄 O contexto ficou muito longo e foi compactado. A sessão será reiniciada. Pode ser necessário re-contextualizar o que estava sendo feito.'

      orchestratorEvents.emitContextReset({
        executionId, conversationId,
        stepId: step.id,
        stepName: step.name,
        reason: resetReason,
      })

      await sessionManager.deleteSession(conversationId, step.id)
      resumeToken = null

      const freshMemory = await memoryManager.getMemory(conversationId, step.id)
      const retrySystemPrompt = buildSystemPrompt({
        stepSystemPrompt: step.systemPrompt,
        projectPath,
        memory: freshMemory,
        useBasePrompt: step.useBasePrompt !== false,
      })

      const retryMonitor = new ExecutionMonitor(executionId, conversationId, step.id)
      if (userId) retryMonitor.setUserId(userId)
      retryMonitor.setInputMetadata({
        messageLength: currentMessage.length,
        systemPrompt: retrySystemPrompt,
        resumeToken: null,
        model: step.model || null,
        projectPath,
      })

      const retryResult = await deps.engine.execute({
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

    let resultStatus = 'success'
    if (result.error) resultStatus = 'error'
    else if (result.timedOut) resultStatus = 'timeout'
    else if (result.cancelled) resultStatus = 'cancelled'
    else if (result.needsUserInput) resultStatus = 'needs_input'

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
