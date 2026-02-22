import type { FastifyInstance } from 'fastify'
import { uploadAttachment } from './upload-attachment.js'

export async function attachmentsRoutes(app: FastifyInstance) {
  await uploadAttachment(app)
}
