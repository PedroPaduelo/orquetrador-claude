import { prisma } from '../../lib/prisma.js'
import { conversationsRepository } from './conversations.repository.js'
import { taskOrchestrator } from '../execution/orchestrator/task-orchestrator.js'
import { BadRequestError, NotFoundError } from '../../http/errors/index.js'

export const conversationsService = {
  async advanceStep(id: string) {
    const conversation = await conversationsRepository.findById(id)
    if (!conversation) throw new NotFoundError('Conversation not found')

    if (conversation.workflow.type !== 'step_by_step') {
      throw new BadRequestError('advance-step is only available for step_by_step workflows')
    }

    const steps = conversation.workflow.steps
    const currentIndex = conversation.currentStepIndex

    if (currentIndex < 0 || currentIndex >= steps.length - 1) {
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
        createdAt: true,
      },
    })

    return {
      conversationId: id,
      isExecuting,
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
}
