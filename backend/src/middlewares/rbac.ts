import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { ForbiddenError } from '../http/errors/index.js'

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const userId = await request.getCurrentUserId()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action')
    }
  }
}
