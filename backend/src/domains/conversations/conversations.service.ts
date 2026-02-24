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
