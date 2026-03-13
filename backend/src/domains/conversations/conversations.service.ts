import { prisma } from '../../lib/prisma.js'
import { conversationsRepository } from './conversations.repository.js'
import { taskOrchestrator } from '../execution/orchestrator/task-orchestrator.js'
import { sessionManager } from '../execution/session/session-manager.js'
import { BadRequestError, NotFoundError } from '../../http/errors/index.js'

export const conversationsService = {
  async advanceStep(id: string) {
    const conversation = await conversationsRepository.findById(id)
    if (!conversation) throw new NotFoundError('Conversation not found')

    if (conversation.workflow.type !== 'step_by_step') {
      throw new BadRequestError('advance-step is only available for step_by_step workflows')
    }

    const steps = conversation.workflow.steps
    if (steps.length === 0) {
      throw new BadRequestError('Workflow has no steps')
    }

    const currentIndex = conversation.currentStepIndex

    // currentStepId null (conversa recem-criada) -> avanca para o primeiro step
    if (currentIndex < 0) {
      const firstStep = steps[0]
      await conversationsRepository.updateCurrentStep(id, firstStep.id)
      return {
        id,
        currentStepId: firstStep.id,
        currentStepIndex: 0,
        message: `Advanced to step: ${firstStep.name}`,
      }
    }

    if (currentIndex >= steps.length - 1) {
      throw new BadRequestError('Already at the last step')
    }

    const nextStep = steps[currentIndex + 1]
    await conversationsRepository.updateCurrentStep(id, nextStep.id)

    return {
      id,
      currentStepId: nextStep.id,
      currentStepIndex: currentIndex + 1,
      message: `Advanced to step: ${nextStep.name}`,
    }
  },

  async goBack(id: string) {
    const conversation = await conversationsRepository.findById(id)
    if (!conversation) throw new NotFoundError('Conversation not found')

    if (conversation.workflow.type !== 'step_by_step') {
      throw new BadRequestError('go-back-step is only available for step_by_step workflows')
    }

    const steps = conversation.workflow.steps
    const currentIndex = conversation.currentStepIndex

    if (currentIndex <= 0) {
      throw new BadRequestError('Already at the first step')
    }

    const prevStep = steps[currentIndex - 1]
    await conversationsRepository.updateCurrentStep(id, prevStep.id)

    return {
      id,
      currentStepId: prevStep.id,
      currentStepIndex: currentIndex - 1,
      message: `Went back to step: ${prevStep.name}`,
    }
  },

  async jumpToStep(id: string, stepId: string) {
    const conversation = await conversationsRepository.findById(id)
    if (!conversation) throw new NotFoundError('Conversation not found')

    if (conversation.workflow.type !== 'step_by_step') {
      throw new BadRequestError('jump-to-step is only available for step_by_step workflows')
    }

    const steps = conversation.workflow.steps
    const targetIndex = steps.findIndex((s) => s.id === stepId)

    if (targetIndex < 0) {
      throw new BadRequestError('Step not found in this workflow')
    }

    const targetStep = steps[targetIndex]
    await conversationsRepository.updateCurrentStep(id, targetStep.id)

    return {
      id,
      currentStepId: targetStep.id,
      currentStepIndex: targetIndex,
      message: `Jumped to step: ${targetStep.name}`,
    }
  },

  async resetStepSession(conversationId: string, stepId: string) {
    const conversation = await conversationsRepository.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation not found')

    if (conversation.workflow.type !== 'step_by_step') {
      throw new BadRequestError('reset-session is only available for step_by_step workflows')
    }

    await sessionManager.deleteSession(conversationId, stepId)
  },

  async cancel(id: string) {
    taskOrchestrator.cancel(id)
    return { success: true, message: 'Execution cancelled' }
  },

  async getStatus(id: string) {
    const isExecuting = taskOrchestrator.isExecuting(id)

    const lastExecution = await prisma.executionState.findFirst({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        state: true,
        currentStepIndex: true,
        metadata: true,
        createdAt: true,
      },
    })

    // Check if paused
    const pausedExecution = await taskOrchestrator.getPausedExecution(id)

    return {
      conversationId: id,
      isExecuting,
      isPaused: !!pausedExecution,
      pausedInfo: pausedExecution ? {
        executionId: pausedExecution.executionId,
        stepId: pausedExecution.stepId,
        stepIndex: pausedExecution.stepIndex,
        resumeToken: pausedExecution.resumeToken,
        pausedAt: pausedExecution.pausedAt,
        askUserQuestion: pausedExecution.askUserQuestion,
      } : null,
      lastExecution: lastExecution
        ? {
            id: lastExecution.id,
            state: lastExecution.state,
            currentStepIndex: lastExecution.currentStepIndex,
            createdAt: lastExecution.createdAt.toISOString(),
          }
        : null,
    }
  },

  async getTokenUsage(conversationId: string) {
    // Get token usage aggregated by step from execution traces
    const usageByStep = await prisma.executionTrace.groupBy({
      by: ['stepId'],
      where: { conversationId: conversationId },
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
    })

    // Get step names
    const stepIds = usageByStep.map((u) => u.stepId)
    const steps = await prisma.workflowStep.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, name: true },
    })

    const stepMap = new Map(steps.map((s) => [s.id, s.name]))

    const stepsWithUsage = usageByStep.map((usage) => ({
      stepId: usage.stepId,
      stepName: stepMap.get(usage.stepId) || 'Unknown Step',
      inputTokens: usage._sum.inputTokens || 0,
      outputTokens: usage._sum.outputTokens || 0,
      totalTokens: (usage._sum.inputTokens || 0) + (usage._sum.outputTokens || 0),
    }))

    const totalInputTokens = stepsWithUsage.reduce((sum, s) => sum + s.inputTokens, 0)
    const totalOutputTokens = stepsWithUsage.reduce((sum, s) => sum + s.outputTokens, 0)

    return {
      conversationId,
      steps: stepsWithUsage,
      totalInputTokens,
      totalOutputTokens,
      grandTotalTokens: totalInputTokens + totalOutputTokens,
    }
  },

  async getExecutionStats(conversationId: string) {
    const traces = await prisma.executionTrace.findMany({
      where: { conversationId },
      select: {
        stepId: true,
        inputTokens: true,
        outputTokens: true,
        cacheCreationInputTokens: true,
        cacheReadInputTokens: true,
        webSearchRequests: true,
        webFetchRequests: true,
        totalCostUsd: true,
        durationMs: true,
        durationApiMs: true,
        numTurns: true,
        stopReason: true,
        claudeCodeVersion: true,
        sessionId: true,
        model: true,
        actionsCount: true,
        exitCode: true,
        resultStatus: true,
        contentLength: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (traces.length === 0) {
      return {
        conversationId,
        tokens: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 },
        cost: { estimatedUsd: null, totalCostUsd: null },
        performance: { totalDurationMs: null, apiDurationMs: null, numTurns: 0 },
        tools: { webSearchRequests: 0, webFetchRequests: 0 },
        steps: [],
        session: null,
      }
    }

    // Aggregate across all traces
    let totalInput = 0, totalOutput = 0, totalCacheCreation = 0, totalCacheRead = 0
    let totalDurationMs = 0, totalApiMs = 0, totalTurns = 0
    let totalWebSearch = 0, totalWebFetch = 0
    let totalCost: number | null = null

    // Per-step aggregation
    const stepAgg = new Map<string, {
      inputTokens: number, outputTokens: number, durationMs: number,
      actionsCount: number, exitCode: number | null, resultStatus: string,
    }>()

    for (const t of traces) {
      totalInput += t.inputTokens
      totalOutput += t.outputTokens
      totalCacheCreation += t.cacheCreationInputTokens
      totalCacheRead += t.cacheReadInputTokens
      totalWebSearch += t.webSearchRequests
      totalWebFetch += t.webFetchRequests
      totalDurationMs += t.durationMs ?? 0
      totalApiMs += t.durationApiMs ?? 0
      totalTurns += t.numTurns

      if (t.totalCostUsd != null) {
        totalCost = (totalCost ?? 0) + t.totalCostUsd
      }

      const existing = stepAgg.get(t.stepId)
      if (existing) {
        existing.inputTokens += t.inputTokens
        existing.outputTokens += t.outputTokens
        existing.durationMs += t.durationMs ?? 0
        existing.actionsCount += t.actionsCount
        existing.exitCode = t.exitCode
        existing.resultStatus = t.resultStatus
      } else {
        stepAgg.set(t.stepId, {
          inputTokens: t.inputTokens,
          outputTokens: t.outputTokens,
          durationMs: t.durationMs ?? 0,
          actionsCount: t.actionsCount,
          exitCode: t.exitCode,
          resultStatus: t.resultStatus,
        })
      }
    }

    // Get step names
    const stepIds = [...stepAgg.keys()]
    const stepsDb = await prisma.workflowStep.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, name: true },
    })
    const stepNameMap = new Map(stepsDb.map((s) => [s.id, s.name]))

    const stepsResult = stepIds.map((stepId) => {
      const agg = stepAgg.get(stepId)!
      return {
        stepId,
        stepName: stepNameMap.get(stepId) || 'Unknown Step',
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        totalTokens: agg.inputTokens + agg.outputTokens,
        durationMs: agg.durationMs || null,
        actionsCount: agg.actionsCount,
        exitCode: agg.exitCode,
        resultStatus: agg.resultStatus,
      }
    })

    // Session metadata from the last trace
    const lastTrace = traces[traces.length - 1]
    const estimatedCost = ((totalInput / 1_000_000) * 3 + (totalOutput / 1_000_000) * 15)

    return {
      conversationId,
      tokens: {
        input: totalInput,
        output: totalOutput,
        cacheCreation: totalCacheCreation,
        cacheRead: totalCacheRead,
        total: totalInput + totalOutput,
      },
      cost: {
        estimatedUsd: estimatedCost > 0 ? Math.round(estimatedCost * 10000) / 10000 : null,
        totalCostUsd: totalCost,
      },
      performance: {
        totalDurationMs: totalDurationMs || null,
        apiDurationMs: totalApiMs || null,
        numTurns: totalTurns,
      },
      tools: {
        webSearchRequests: totalWebSearch,
        webFetchRequests: totalWebFetch,
      },
      steps: stepsResult,
      session: {
        claudeCodeVersion: lastTrace.claudeCodeVersion,
        sessionId: lastTrace.sessionId,
        model: lastTrace.model,
        stopReason: lastTrace.stopReason,
      },
    }
  },
}
