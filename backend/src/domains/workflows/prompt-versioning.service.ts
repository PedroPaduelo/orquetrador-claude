import { prisma } from '../../lib/prisma.js'

export const promptVersioningService = {
  async createVersion(stepId: string, content: string, userId: string) {
    const lastVersion = await prisma.promptVersion.findFirst({
      where: { stepId },
      orderBy: { version: 'desc' },
    })
    const version = (lastVersion?.version || 0) + 1

    // Simple diff: store previous content reference
    const diff = lastVersion ? `Changed from version ${lastVersion.version}` : 'Initial version'

    return prisma.promptVersion.create({
      data: { stepId, version, content, diff, createdBy: userId },
    })
  },

  async listVersions(stepId: string) {
    const versions = await prisma.promptVersion.findMany({
      where: { stepId },
      orderBy: { version: 'desc' },
      include: { creator: { select: { name: true, email: true } } },
    })
    return versions.map(v => ({
      id: v.id,
      stepId: v.stepId,
      version: v.version,
      content: v.content,
      diff: v.diff,
      createdBy: v.creator.name || v.creator.email,
      createdAt: v.createdAt.toISOString(),
    }))
  },

  async rollback(stepId: string, versionId: string) {
    const version = await prisma.promptVersion.findUnique({ where: { id: versionId } })
    if (!version || version.stepId !== stepId) return null

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { systemPrompt: version.content },
    })
    return version
  },
}
