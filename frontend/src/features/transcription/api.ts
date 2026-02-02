import { apiClient } from '@/shared/lib/api-client'
import type { TranscriptionResult, TranscriptionOptions } from './types'

export async function transcribeAudio(
  file: File,
  options?: TranscriptionOptions
): Promise<TranscriptionResult> {
  const formData = new FormData()
  formData.append('audio', file)

  if (options?.language) {
    formData.append('language', options.language)
  }
  if (options?.prompt) {
    formData.append('prompt', options.prompt)
  }

  const { data } = await apiClient.post('/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}
