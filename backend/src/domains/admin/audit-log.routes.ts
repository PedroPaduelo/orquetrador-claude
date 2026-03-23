import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireRole } from '../../middlewares/rbac.js'
import { NotFoundError } from '../../http/errors/index.js'

const resourceTypeEnum = z.enum([
  'mcp_server', 'skill', 'agent', 'rule', 'hook', 'plugin', 'workflow',
])

const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  resourceName: z.string().nullable(),
  diff: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string(),
  createdAt: z.string(),
})

export async function auditLogRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get('/admin/audit-logs', {
    schema: {
      tags: ['Admin'],
      summary: 'List audit logs with pagination and filters',
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(100).default(20),
        resourceType: resourceTypeEnum.optional(),
        action: z.enum(['create', 'update', 'delete', 'execute']).optional(),
        userId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
      response: {
        200: z.object({
          data: z.array(auditLogSchema),
          total: z.number(),
          page: z.number(),
          perPage: z.number(),
          totalPages: z.number(),
        }),
      },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const { page, perPage, resourceType, action, userId, dateFrom, dateTo } = request.query

    const where: Record<string, unknown> = {}
    if (resourceType) where.resourceType = resourceType
    if (action) where.action = action
    if (userId) where.userId = userId
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        diff: log.diff,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userId: log.userId,
        userName: log.user.name,
        userEmail: log.user.email,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  })

  server.get('/admin/audit-logs/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Get audit log detail',
      params: z.object({ id: z.string() }),
      response: { 200: auditLogSchema },
    },
    preHandler: [requireRole('admin')],
  }, async (request) => {
    const log = await prisma.auditLog.findUnique({
      where: { id: request.params.id },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!log) throw new NotFoundError('Audit log not found')

    return {
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      resourceName: log.resourceName,
      diff: log.diff,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userId: log.userId,
      userName: log.user.name,
      userEmail: log.user.email,
      createdAt: log.createdAt.toISOString(),
    }
  })
}
