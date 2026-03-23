import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../http/errors/index.js'
import { getRedis } from '../lib/redis.js'

function matchScope(scope: string, route: string): boolean {
  // scope format: "resource:action" e.g. "workflows:read", "executions:*", "admin:*"
  // route format derived from URL: "workflows:read", "workflows:write", etc.
  if (scope === '*' || scope === '*:*') return true
  const [scopeResource, scopeAction] = scope.split(':')
  const [routeResource, routeAction] = route.split(':')
  if (scopeResource === '*') return true
  if (scopeResource !== routeResource) return false
  if (scopeAction === '*') return true
  return scopeAction === routeAction
}

function deriveRouteScope(method: string, url: string): string {
  // Extract resource from URL path: /api/workflows/... -> workflows
  const parts = url.replace(/^\/api\//, '').split('/').filter(Boolean)
  const resource = parts[0] || 'unknown'

  // Normalize resource names (remove trailing s for some, keep kebab-case)
  const normalizedResource = resource.replace(/-/g, '_')

  // Map HTTP method to action
  const methodMap: Record<string, string> = {
    GET: 'read',
    HEAD: 'read',
    OPTIONS: 'read',
    POST: 'write',
    PUT: 'write',
    PATCH: 'write',
    DELETE: 'delete',
  }
  const action = methodMap[method.toUpperCase()] || 'read'

  return `${normalizedResource}:${action}`
}

export async function apiKeyEnforcement(request: FastifyRequest, _reply: FastifyReply) {
  const keyInfo = request.apiKeyInfo
  if (!keyInfo) return // Not an API key request, skip

  // 1. IP Whitelist check
  if (keyInfo.ipWhitelist.length > 0) {
    const clientIp = request.ip
    if (!keyInfo.ipWhitelist.includes(clientIp)) {
      throw new ForbiddenError(`IP ${clientIp} not in API key whitelist`)
    }
  }

  // 2. Scope check
  if (keyInfo.scopes.length > 0) {
    const routeScope = deriveRouteScope(request.method, request.url)
    const hasScope = keyInfo.scopes.some(s => matchScope(s, routeScope))
    if (!hasScope) {
      throw new ForbiddenError(`API key lacks scope for ${routeScope}`)
    }
  }

  // 3. Rate limit check (per-key, requests per minute)
  if (keyInfo.rateLimit && keyInfo.rateLimit > 0) {
    try {
      const redis = getRedis()
      const redisKey = `ratelimit:apikey:${keyInfo.id}`
      const current = await redis.incr(redisKey)
      if (current === 1) {
        await redis.expire(redisKey, 60)
      }
      if (current > keyInfo.rateLimit) {
        throw new ForbiddenError(
          `API key rate limit exceeded (${keyInfo.rateLimit} requests/minute)`,
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
      // Redis unavailable — allow request but log
      console.warn('[ApiKeyEnforcement] Redis unavailable for rate limit check:', (err as Error).message)
    }
  }
}
