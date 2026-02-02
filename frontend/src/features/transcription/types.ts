export interface TranscriptionResult {
  text: string
  duration: number
  language: string
}

export interface TranscriptionOptions {
  language?: string
  prompt?: string
}
