import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

type MessageAttachment = {
  id: string
  filename: string
  mimeType: string
  size: number
  path: string
  projectPath: string
  url: string
}

type MessageResponse = {
  id: string
  role: string
  content: string
  stepId: string | null
  stepName: string | null
  selectedForContext: boolean
  metadata: unknown | null
  attachments?: MessageAttachment[]
  createdAt: string
}

function fromDb(m: {
  id: string
  role: string
  content: string
  stepId: string | null
  selectedForContext: boolean
  metadata: unknown
  createdAt: Date
  step?: { name: string } | null
  attachments?: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    path: string
    projectPath: string
    url: string
  }>
}): MessageResponse {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    stepId: m.stepId,
    stepName: m.step?.name ?? null,
    selectedForContext: m.selectedForContext,
    metadata: m.metadata ?? null,
    attachments:
      m.attachments && m.attachments.length > 0
        ? m.attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            path: a.path,
            projectPath: a.projectPath,
            url: a.url,
          }))
        : undefined,
    createdAt: m.createdAt.toISOString(),
  }
}

export const messagesRepository = {
  async findByConversation(conversationId: string, stepId?: string): Promise<MessageResponse[]> {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(stepId ? { stepId } : {}),
      },
      include: {
        step: { select: { name: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return messages.map(fromDb)
  },

  async findById(id: string): Promise<MessageResponse | null> {
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        step: { select: { name: true } },
        attachments: true,
      },
    })

    return message ? fromDb(message) : null
  },

  async delete(id: string): Promise<void> {
    await prisma.message.delete({ where: { id } })
  },

  async toggleContext(id: string, selected: boolean): Promise<{ id: string; selectedForContext: boolean }> {
    const updated = await prisma.message.update({
      where: { id },
      data: { selectedForContext: selected },
    })

    return { id: updated.id, selectedForContext: updated.selectedForContext }
  },

  async updateActions(id: string, actions: unknown[]): Promise<{ id: string; success: boolean }> {
    const message = await prisma.message.findUnique({ where: { id } })

    if (!message) {
      return { id, success: false }
    }

    const currentMetadata = (message.metadata ?? {}) as Record<string, unknown>

    await prisma.message.update({
      where: { id },
      data: {
        metadata: {
          ...currentMetadata,
          actions,
        } as Prisma.InputJsonValue,
      },
    })

    return { id, success: true }
  },
}
