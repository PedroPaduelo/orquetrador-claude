import Groq from 'groq-sdk'
import { env } from '../../lib/env.js'

export class GroqTranscriptionService {
  private client: Groq | null = null

  constructor() {
    if (env.GROQ_API_KEY) {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY })
    }
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.client) {
      throw new Error('Groq is not configured')
    }

    // Create a File-like object from the buffer
    const uint8Array = new Uint8Array(audioBuffer)
    const blob = new Blob([uint8Array], { type: mimeType })
    const file = new File([blob], 'audio.webm', { type: mimeType })

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'pt',
      response_format: 'verbose_json',
    })

    return transcription.text
  }
}

export const groqService = new GroqTranscriptionService()
