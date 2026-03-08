import { prisma } from '../../lib/prisma.js'

export const conversationsRepository = {
  async findAll(userId: string, workflowId?: string) {
    const conversations = await prisma.conversation.findMany({
      where: { userId, ...(workflowId ? { workflowId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        workflow: {
          select: { name: true, type: true },
        },
        currentStep: {
          select: { name: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      projectPath: c.projectPath ?? null,
      workflowId: c.workflowId,
      workflowName: c.workflow.name,
      workflowType: c.workflow.type,
      currentStepId: c.currentStepId,
      currentStepName: c.currentStep?.name ?? null,
      messagesCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  },

  async findById(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            steps: {
              select: { id: true, name: true, stepOrder: true },
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            step: { select: { name: true } },
            attachments: true,
          },
        },
      },
    })

    if (!conversation) return null

    const steps = conversation.workflow.steps
    const currentStepIndex = conversation.currentStepId
      ? steps.findIndex((s) => s.id === conversation.currentStepId)
      : -1

    return {
      id: conversation.id,
      title: conversation.title,
      projectPath: conversation.projectPath,
      workflowId: conversation.workflowId,
      workflow: {
        id: conversation.workflow.id,
        name: conversation.workflow.name,
        type: conversation.workflow.type,
        steps: steps.map((s) => ({ id: s.id, name: s.name, stepOrder: s.stepOrder })),
      },
      currentStepId: conversation.currentStepId,
      currentStepIndex,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        stepId: m.stepId,
        stepName: m.step?.name ?? null,
        selectedForContext: m.selectedForContext,
        metadata: m.metadata
          ? (typeof m.metadata === 'string'
              ? (() => { try { return JSON.parse(m.metadata) } catch { return null } })()
              : m.metadata)
          : null,
        attachments: m.attachments.length > 0
          ? m.attachments.map((a) => ({
              id: a.id,
              filename: a.filename,
              mimeType: a.mimeType,
              size: a.size,
              url: a.url,
            }))
          : undefined,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    }
  },

  async create(input: { workflowId: string; title?: string; projectPath: string }, userId: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId, userId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          take: 1,
        },
      },
    })

    if (!workflow) return null

    const firstStep = workflow.steps[0] ?? null

    const conversation = await prisma.conversation.create({
      data: {
        workflowId: input.workflowId,
        title: input.title ?? null,
        projectPath: input.projectPath,
        currentStepId: firstStep?.id ?? null,
        userId,
      },
    })

    return {
      id: conversation.id,
      workflowId: conversation.workflowId,
      title: conversation.title,
      projectPath: conversation.projectPath,
      currentStepId: conversation.currentStepId,
      createdAt: conversation.createdAt.toISOString(),
    }
  },

  async delete(id: string) {
    await prisma.conversation.delete({ where: { id } })
  },

  async updateCurrentStep(id: string, stepId: string) {
    await prisma.conversation.update({
      where: { id },
      data: { currentStepId: stepId },
    })
  },

  async updateTitle(id: string, title: string) {
    await prisma.conversation.update({
      where: { id },
      data: { title },
    })
  },

  async findByIdSimple(id: string) {
    return prisma.conversation.findUnique({ where: { id } })
  },

  async clone(sourceId: string, userId: string) {
    const source = await prisma.conversation.findUnique({
      where: { id: sourceId },
      include: {
        workflow: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' as const },
              take: 1,
            },
          },
        },
      },
    })

    if (!source) return null

    const firstStep = source.workflow.steps[0] ?? null

    const conversation = await prisma.conversation.create({
      data: {
        workflowId: source.workflowId,
        title: source.title ? `${source.title} (cópia)` : null,
        projectPath: source.projectPath,
        currentStepId: firstStep?.id ?? null,
        userId,
      },
    })

    return {
      id: conversation.id,
      workflowId: conversation.workflowId,
      title: conversation.title,
      projectPath: conversation.projectPath,
      currentStepId: conversation.currentStepId,
      createdAt: conversation.createdAt.toISOString(),
    }
  },
}
