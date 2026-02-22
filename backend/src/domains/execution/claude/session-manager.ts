import { prisma } from '../../../lib/prisma.js'

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
   * Get context messages that the USER explicitly selected via selectedForContext toggle.
   * Used only on cold start of a new step (no existing session to resume).
   * Returns exactly what the user chose — no truncation, no limits.
   */
  async getSelectedContext(conversationId: string): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        selectedForContext: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
    })

    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  }
}

export const sessionManager = new SessionManager()
