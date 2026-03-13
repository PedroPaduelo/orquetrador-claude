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

  // Unhandled errors
  console.error('Unhandled error:', error)
  if (error.stack) {
    console.error('Stack:', error.stack)
  }

  return reply.status(500).send({
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message }),
  })
}
