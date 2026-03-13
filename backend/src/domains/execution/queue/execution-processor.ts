import type { Job } from 'bullmq'
import type { ExecutionJobData } from './execution-queue.js'
import { prisma } from '../../../lib/prisma.js'
import { taskOrchestrator } from '../orchestrator/task-orchestrator.js'
import { isDAGWorkflow } from '../orchestrator/dag-executor.js'
import { getPublisher } from '../../../lib/redis.js'

export async function processExecutionJob(job: Job<ExecutionJobData>): Promise<void> {
  const { conversationId, content, stepIndex, projectPath, workflowType, userId, attachments } = job.data
  const pub = getPublisher()
  const channel = `execution:${conversationId}`

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
    await pub.publish(channel, JSON.stringify({ event: 'error', data: { message: 'Conversation not found' } }))
    return
  }

  const context = {
    conversationId,
    workflowId: conversation.workflowId,
    steps: conversation.workflow.steps,
    projectPath,
    userId,
    attachments,
  }

  try {
    if (workflowType === 'sequential' && isDAGWorkflow(conversation.workflow.steps)) {
      await taskOrchestrator.executeDAG(context, content)
    } else if (workflowType === 'sequential') {
      await taskOrchestrator.executeSequential(context, content)
    } else {
      const currentIndex =
        stepIndex ??
        (conversation.currentStepId
          ? conversation.workflow.steps.findIndex((s) => s.id === conversation.currentStepId)
          : 0)
      await taskOrchestrator.executeStepByStep(context, content, Math.max(0, currentIndex))
    }
  } catch (error) {
    await pub.publish(channel, JSON.stringify({
      event: 'error',
      data: { message: error instanceof Error ? error.message : 'Unknown error' },
    }))
  }
}
