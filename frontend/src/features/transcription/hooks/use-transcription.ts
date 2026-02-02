import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { transcribeAudio } from '../api'
import type { TranscriptionOptions, TranscriptionResult } from '../types'

export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])

  const mutation = useMutation({
    mutationFn: ({ file, options }: { file: File; options?: TranscriptionOptions }) =>
      transcribeAudio(file, options),
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        setAudioChunks(chunks)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      throw new Error('Nao foi possivel acessar o microfone')
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' })
          setIsRecording(false)
          setMediaRecorder(null)
          setAudioChunks([])
          resolve(blob)
        }
        mediaRecorder.stop()
      }
    })
  }, [mediaRecorder, audioChunks])

  const transcribe = useCallback(
    async (audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptionResult> => {
      const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
      return mutation.mutateAsync({ file, options })
    },
    [mutation]
  )

  const transcribeFile = useCallback(
    async (file: File, options?: TranscriptionOptions): Promise<TranscriptionResult> => {
      return mutation.mutateAsync({ file, options })
    },
    [mutation]
  )

  return {
    isRecording,
    isTranscribing: mutation.isPending,
    error: mutation.error,
    result: mutation.data,
    startRecording,
    stopRecording,
    transcribe,
    transcribeFile,
  }
}
