import { prisma } from './prisma.js'
import type { ResourceType } from '@prisma/client'

interface AuditLogParams {
  userId: string
  action: 'create' | 'update' | 'delete' | 'execute'
  resourceType: ResourceType
  resourceId: string
  resourceName?: string
  diff?: { before?: unknown; after?: unknown }
  metadata?: Record<string, unknown>
}

export function logAudit(params: AuditLogParams): void {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        resourceName: params.resourceName,
        diff: params.diff as object ?? undefined,
        metadata: params.metadata as object ?? undefined,
      },
    })
    .catch((err) => {
      console.error('[AuditLog] Failed to log audit:', err)
    })
}
