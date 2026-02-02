import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { groqService } from '../../../services/transcription/groq-service.js'
import { BadRequestError } from '../_errors/index.js'

export async function transcribeAudio(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/transcribe',
    {
      schema: {
        tags: ['Transcription'],
        summary: 'Transcribe audio using Groq Whisper',
        consumes: ['multipart/form-data'],
        response: {
          200: z.object({
            text: z.string(),
          }),
        },
      },
    },
    async (request) => {
      if (!groqService.isConfigured()) {
        throw new BadRequestError('Groq transcription is not configured')
      }

      const data = await request.file()
      if (!data) {
        throw new BadRequestError('No audio file provided')
      }

      const buffer = await data.toBuffer()
      const mimeType = data.mimetype || 'audio/webm'

      const text = await groqService.transcribe(buffer, mimeType)

      return { text }
    }
  )
}
