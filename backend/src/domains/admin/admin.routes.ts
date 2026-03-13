import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireRole } from '../../middlewares/rbac.js'
import { NotFoundError } from '../../http/errors/index.js'

export async function adminRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/admin/users', {
    schema: {
      tags: ['Admin'],
      summary: 'List all users (admin only)',
      response: {
        200: z.array(z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().nullable(),
          role: z.string(),
          createdAt: z.string(),
        })),
      },
    },
    preHandler: [requireRole('admin')],
  }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    return users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))
  })

  server.put('/admin/users/:id/role', {
    schema: {
      tags: ['Admin'],
      summary: 'Update user role (admin only)',
      params: z.object({ id: z.string() }),
      body: z.object({ role: z.enum(['admin', 'developer', 'viewer']) }),
      response: {
        200: z.object({ id: z.string(), role: z.string() }),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const { id } = request.params
    const { role } = request.body
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('User not found')
    const updated = await prisma.user.update({ where: { id }, data: { role } })
    return { id: updated.id, role: updated.role }
  })

  server.delete('/admin/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Delete user (admin only)',
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const { id } = request.params
    if (id === userId) {
      throw new Error('Cannot delete yourself')
    }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('User not found')
    await prisma.user.delete({ where: { id } })
    return reply.status(204).send(null)
  })
}
