import type { Job } from 'bullmq'
import type { ExecutionJobData } from './execution-queue.js'
import { prisma } from '../../../lib/prisma.js'
import { taskOrchestrator } from '../orchestrator/task-orchestrator.js'
import { isDAGWorkflow } from '../orchestrator/dag-executor.js'
import { getMaxConcurrency } from '../orchestrator/orchestrator-utils.js'
import { orchestratorEvents } from '../orchestrator/events.js'
import type { PausedExecutionInfo } from '../orchestrator/execution-state.js'

export async function processExecutionJob(job: Job<ExecutionJobData>): Promise<void> {
  const {
    conversationId, content, stepIndex, projectPath, workflowType, userId, attachments,
    maxConcurrency: jobMaxConcurrency,
    isResume, pausedExecutionId, pausedStepIndex, pausedStepId, pausedResumeToken, pausedAskUserQuestion,
  } = job.data

  console.log(
    `[ExecutionProcessor] Processing job ${job.id} for conversation ${conversationId}` +
    (isResume ? ` (resume execution ${pausedExecutionId})` : ` (${workflowType})`),
  )

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      workflow: {
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      },
    },
  })

  if (!conversation) {
    // Emit on the events system so any SSE listener gets the error
    orchestratorEvents.emit('execution:error', { conversationId, message: 'Conversation not found' })
    throw new Error(`Conversation ${conversationId} not found`)
  }

  const context = {
    conversationId,
    workflowId: conversation.workflowId,
    steps: conversation.workflow.steps,
    projectPath,
    userId,
    attachments,
    maxConcurrency: jobMaxConcurrency ?? getMaxConcurrency(conversation.workflow.config),
  }

  try {
    // Handle resume from paused execution
    if (isResume && pausedExecutionId) {
      // Try to get the paused execution info from the state manager first
      const pausedExecution = await taskOrchestrator.getPausedExecution(conversationId)

      if (pausedExecution) {
        console.log(`[ExecutionProcessor] Resuming paused execution ${pausedExecution.executionId} from state manager`)
        await taskOrchestrator.resumeExecution(context, content, pausedExecution)
      } else {
        // Reconstruct from job data (e.g. after a restart where in-memory state was lost)
        console.log(`[ExecutionProcessor] Reconstructing paused execution ${pausedExecutionId} from job data`)
        const reconstructed: PausedExecutionInfo = {
          executionId: pausedExecutionId,
          conversationId,
          stepIndex: pausedStepIndex ?? 0,
          stepId: pausedStepId ?? '',
          resumeToken: pausedResumeToken ?? null,
          pausedAt: new Date().toISOString(),
          askUserQuestion: pausedAskUserQuestion,
        }
        await taskOrchestrator.resumeExecution(context, content, reconstructed)
      }
    } else if (workflowType === 'sequential' && isDAGWorkflow(conversation.workflow.steps)) {
      // DAG workflow detected within a sequential workflow
      await taskOrchestrator.executeDAG(context, content)
    } else if (workflowType === 'sequential') {
      await taskOrchestrator.executeSequential(context, content)
    } else {
      // step_by_step mode
      const currentIndex =
        stepIndex ??
        (conversation.currentStepId
          ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
          : 0)
      await taskOrchestrator.executeStepByStep(context, content, Math.max(0, currentIndex))
    }

    console.log(`[ExecutionProcessor] Job ${job.id} completed successfully for conversation ${conversationId}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ExecutionProcessor] Job ${job.id} failed for conversation ${conversationId}:`, message)

    // Emit error through the events system so SSE clients get notified
    orchestratorEvents.emit('execution:error', { conversationId, message })

    // Re-throw so BullMQ marks the job as failed
    throw error
  }
}
