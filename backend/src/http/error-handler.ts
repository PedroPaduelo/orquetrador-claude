import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from './errors/index.js'

type FastifyErrorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => void

export const errorHandler: FastifyErrorHandler = (error, _request, reply) => {
  // Zod validation errors from Fastify schema validation
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      message: 'Validation error',
      errors: error.validation.map((e) => ({
        message: e.message,
        path: e.params.issue.path.join('.'),
      })),
    })
  }

  // Direct Zod errors
  if (error instanceof ZodError) {
    return reply.status(422).send(fromZodError(error))
  }

  // Custom errors
  if (error instanceof BadRequestError) {
    return reply.status(400).send({ message: error.message })
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({ message: error.message })
  }

  if (error instanceof ForbiddenError) {
    return reply.status(403).send({ message: error.message })
  }

  if (error instanceof NotFoundError) {
    return reply.status(404).send({ message: error.message })
  }

  if (error instanceof ConflictError) {
    return reply.status(409).send({ message: error.message })
  }

  // Rate limit errors (from @fastify/rate-limit or manual 429)
  if (error.statusCode === 429) {
    return reply.status(429).send({
      message: error.message || 'Rate limit exceeded',
    })
  }

  // Prisma errors — database connectivity / constraint issues
  if (error.message?.includes('prisma') || error.message?.includes('ECONNREFUSED') || (error as any).code === 'P2002' || (error as any).code === 'P2025') {
    console.error('Database error:', error.message)
    const status = (error as any).code === 'P2025' ? 404 : 503
    return reply.status(status).send({
      message: status === 404 ? 'Resource not found' : 'Database temporarily unavailable',
    })
  }

  // Redis errors
  if (error.message?.includes('Redis') || error.message?.includes('ECONNREFUSED') || error.message?.includes('MaxRetriesPerRequestError')) {
    console.error('Redis error:', error.message)
    return reply.status(503).send({
      message: 'Service temporarily unavailable',
    })
  }

  // Reply already sent (SSE streams, etc.)
  if (reply.sent) {
    console.error('Error after reply sent:', error.message)
    return
  }

  // Unhandled errors
  console.error('Unhandled error:', error.message || error)
  if (error.stack) {
    console.error('Stack:', error.stack)
  }

  return reply.status(500).send({
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message }),
  })
}
