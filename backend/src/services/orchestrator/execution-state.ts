import { prisma } from '../../lib/prisma.js'
import type { ExecutionStatus } from '@prisma/client'

export interface ExecutionStateData {
  id: string
  conversationId: string
  state: ExecutionStatus
  currentStepIndex: number
  retryCounts: Record<string, number>
  metadata: Record<string, unknown>
}

export class ExecutionStateManager {
  async create(conversationId: string): Promise<ExecutionStateData> {
    const id = `exec_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const state = await prisma.executionState.create({
      data: {
        id,
        conversationId,
        state: 'running',
        currentStepIndex: 0,
        retryCounts: {},
        metadata: {
          startedAt: new Date().toISOString(),
        },
      },
    })

    return {
      id: state.id,
      conversationId: state.conversationId,
      state: state.state,
      currentStepIndex: state.currentStepIndex,
      retryCounts: state.retryCounts as Record<string, number>,
      metadata: state.metadata as Record<string, unknown>,
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
      state: state.state,
      currentStepIndex: state.currentStepIndex,
      retryCounts: state.retryCounts as Record<string, number>,
      metadata: state.metadata as Record<string, unknown>,
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
      state: state.state,
      currentStepIndex: state.currentStepIndex,
      retryCounts: state.retryCounts as Record<string, number>,
      metadata: state.metadata as Record<string, unknown>,
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

      const mergedMetadata = {
        ...(current?.metadata as Record<string, unknown> || {}),
        ...metadata,
      } as object

      await prisma.executionState.update({
        where: { id: executionId },
        data: { state, metadata: mergedMetadata },
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
        data: data as object,
      },
    })
  }
}

export const executionStateManager = new ExecutionStateManager()
