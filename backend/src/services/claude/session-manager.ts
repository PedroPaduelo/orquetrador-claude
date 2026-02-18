import { prisma } from '../../lib/prisma.js'

export class SessionManager {
  async getSession(conversationId: string, stepId: string): Promise<string | null> {
    const session = await prisma.conversationSession.findUnique({
      where: {
        conversationId_stepId: {
          conversationId,
          stepId,
        },
      },
    })

    return session?.claudeSessionId || null
  }

  async saveSession(conversationId: string, stepId: string, claudeSessionId: string): Promise<void> {
    await prisma.conversationSession.upsert({
      where: {
        conversationId_stepId: {
          conversationId,
          stepId,
        },
      },
      create: {
        conversationId,
        stepId,
        claudeSessionId,
      },
      update: {
        claudeSessionId,
      },
    })
  }

  async deleteSession(conversationId: string, stepId: string): Promise<void> {
    await prisma.conversationSession.deleteMany({
      where: {
        conversationId,
        stepId,
      },
    })
  }

  async deleteAllSessions(conversationId: string): Promise<void> {
    await prisma.conversationSession.deleteMany({
      where: { conversationId },
    })
  }

  /**
   * Get a compact summary of prior context instead of sending all messages.
   * Only used when there's no existing Claude session to resume.
   * Returns at most the last 3 exchanges (6 messages) truncated.
   */
  async getInitialContext(conversationId: string): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        selectedForContext: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6, // Last 3 exchanges max
      select: {
        role: true,
        content: true,
      },
    })

    // Reverse to chronological order and truncate long messages
    return messages.reverse().map((m) => ({
      role: m.role,
      content: m.content.length > 500 ? m.content.substring(0, 500) + '...' : m.content,
    }))
  }
}

export const sessionManager = new SessionManager()
