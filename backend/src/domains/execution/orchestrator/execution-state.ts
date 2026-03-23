import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'

type ExecutionStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface PausedExecutionInfo {
  executionId: string
  conversationId: string
  stepIndex: number
  stepId: string
  resumeToken: string | null
  pausedAt: string
  askUserQuestion?: {
    question: string
    options?: Array<{ label: string; description?: string }>
  }
}

export interface ExecutionStateData {
  id: string
  conversationId: string
  state: ExecutionStatus
  currentStepIndex: number
  retryCounts: Record<string, number>
  metadata: Record<string, unknown>
}

export class ExecutionStateManager {
  async create(conversationId: string, stepIndex = 0): Promise<ExecutionStateData> {
    const id = `exec_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const state = await prisma.executionState.create({
      data: {
        id,
        conversationId,
        state: 'running',
        currentStepIndex: stepIndex,
        retryCounts: {},
        metadata: {
          startedAt: new Date().toISOString(),
        },
      },
    })

    return {
      id: state.id,
      conversationId: state.conversationId,
      state: state.state as ExecutionStatus,
      currentStepIndex: state.currentStepIndex,
      retryCounts: (state.retryCounts ?? {}) as Record<string, number>,
      metadata: (state.metadata ?? {}) as Record<string, unknown>,
    }
  }

  async get(executionId: string): Promise<ExecutionStateData | null> {
    const state = await prisma.executionState.findUnique({
      where: { id: executionId },
    })

    if (!state) return null

    return {
      id: state.id,
      conversationId: state.conversationId,
      state: state.state as ExecutionStatus,
      currentStepIndex: state.currentStepIndex,
      retryCounts: (state.retryCounts ?? {}) as Record<string, number>,
      metadata: (state.metadata ?? {}) as Record<string, unknown>,
    }
  }

  async getByConversation(conversationId: string): Promise<ExecutionStateData | null> {
    const state = await prisma.executionState.findFirst({
      where: {
        conversationId,
        state: 'running',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!state) return null

    return {
      id: state.id,
      conversationId: state.conversationId,
      state: state.state as ExecutionStatus,
      currentStepIndex: state.currentStepIndex,
      retryCounts: (state.retryCounts ?? {}) as Record<string, number>,
      metadata: (state.metadata ?? {}) as Record<string, unknown>,
    }
  }

  async updateStepIndex(executionId: string, stepIndex: number): Promise<void> {
    await prisma.executionState.update({
      where: { id: executionId },
      data: { currentStepIndex: stepIndex },
    })
  }

  async updateRetryCounts(executionId: string, retryCounts: Record<string, number>): Promise<void> {
    await prisma.executionState.update({
      where: { id: executionId },
      data: { retryCounts },
    })
  }

  async updateStatus(executionId: string, state: ExecutionStatus, metadata?: Record<string, unknown>): Promise<void> {
    if (metadata) {
      const current = await prisma.executionState.findUnique({
        where: { id: executionId },
        select: { metadata: true },
      })

      const currentMeta = (current?.metadata ?? {}) as Record<string, unknown>
      const mergedMetadata = {
        ...currentMeta,
        ...metadata,
      }

      await prisma.executionState.update({
        where: { id: executionId },
        data: { state, metadata: mergedMetadata as Prisma.InputJsonValue },
      })
    } else {
      await prisma.executionState.update({
        where: { id: executionId },
        data: { state },
      })
    }
  }

  async markCompleted(executionId: string): Promise<void> {
    await this.updateStatus(executionId, 'completed', {
      completedAt: new Date().toISOString(),
    })
  }

  async markFailed(executionId: string, error: string): Promise<void> {
    await this.updateStatus(executionId, 'failed', {
      failedAt: new Date().toISOString(),
      error,
    })
  }

  async markCancelled(executionId: string): Promise<void> {
    await this.updateStatus(executionId, 'cancelled', {
      cancelledAt: new Date().toISOString(),
    })
  }

  async markPaused(
    executionId: string,
    stepIndex: number,
    stepId: string,
    resumeToken: string | null,
    askUserQuestion?: PausedExecutionInfo['askUserQuestion'],
  ): Promise<void> {
    await this.updateStatus(executionId, 'paused', {
      pausedAt: new Date().toISOString(),
      pausedStepIndex: stepIndex,
      pausedStepId: stepId,
      pausedResumeToken: resumeToken,
      askUserQuestion: askUserQuestion || null,
    })
  }

  async getPausedExecution(conversationId: string): Promise<PausedExecutionInfo | null> {
    const state = await prisma.executionState.findFirst({
      where: {
        conversationId,
        state: 'paused',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!state) return null

    const meta = (state.metadata ?? {}) as Record<string, unknown>

    return {
      executionId: state.id,
      conversationId: state.conversationId,
      stepIndex: (meta.pausedStepIndex as number) ?? state.currentStepIndex,
      stepId: (meta.pausedStepId as string) ?? '',
      resumeToken: (meta.pausedResumeToken as string | null) ?? null,
      pausedAt: (meta.pausedAt as string) ?? '',
      askUserQuestion: (meta.askUserQuestion as PausedExecutionInfo['askUserQuestion']) ?? undefined,
    }
  }

  async resumeFromPaused(executionId: string): Promise<void> {
    await this.updateStatus(executionId, 'running', {
      resumedAt: new Date().toISOString(),
    })
  }

  async saveCheckpoint(executionId: string, stepIndex: number, output: string, nextInput: string): Promise<void> {
    const current = await prisma.executionState.findUnique({
      where: { id: executionId },
      select: { metadata: true },
    })
    const currentMeta = (current?.metadata ?? {}) as Record<string, unknown>
    const checkpoints = (currentMeta.checkpoints as unknown[] || [])
    checkpoints.push({ stepIndex, outputLength: output.length, nextInputLength: nextInput.length, savedAt: new Date().toISOString() })
    const mergedMetadata = { ...currentMeta, checkpoints, lastCheckpointStepIndex: stepIndex, lastCheckpointAt: new Date().toISOString() }
    await prisma.executionState.update({
      where: { id: executionId },
      data: { metadata: mergedMetadata as Prisma.InputJsonValue },
    })
  }

  async getCheckpoint(executionId: string): Promise<{ stepIndex: number } | null> {
    const state = await this.get(executionId)
    if (!state) return null
    const meta = state.metadata as Record<string, unknown>
    if (meta.lastCheckpointStepIndex !== undefined) {
      return { stepIndex: meta.lastCheckpointStepIndex as number }
    }
    return null
  }

  async logEvent(
    executionId: string,
    conversationId: string,
    eventType: string,
    data: Record<string, unknown>,
    stepId?: string,
    stepName?: string
  ): Promise<void> {
    await prisma.executionLog.create({
      data: {
        executionId,
        conversationId,
        eventType,
        stepId,
        stepName,
        data: data as Prisma.InputJsonValue,
      },
    })
  }
}

export const executionStateManager = new ExecutionStateManager()
