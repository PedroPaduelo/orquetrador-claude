import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Mic, MicOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { ImageUploader } from './image-uploader'
import { useImageUpload } from '../hooks/use-image-upload'
import type { Attachment } from '../types'

interface MessageInputProps {
  conversationId: string
  onSend: (content: string, attachments?: Attachment[]) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
}

// Tipos para Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function MessageInput({ conversationId, onSend, onCancel, isStreaming, disabled }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const {
    attachments,
    isUploading,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useImageUpload({ conversationId })

  const handleSubmit = () => {
    const hasContent = content.trim() || attachments.length > 0
    if (!hasContent || isStreaming || disabled || isUploading) return
    onSend(content.trim(), attachments.length > 0 ? attachments : undefined)
    setContent('')
    clearAttachments()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Handle Ctrl+V paste with images from clipboard
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      await addFiles(imageFiles)
    }
  }, [addFiles])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [content])

  // Inicializa o reconhecimento de voz
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return null

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        }
      }

      if (finalTranscript) {
        setContent(prev => prev + finalTranscript)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    return recognition
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition()
      }
      if (recognitionRef.current) {
        recognitionRef.current.start()
        setIsListening(true)
      }
    }
  }, [isListening, initSpeechRecognition])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !isUploading

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Image upload button */}
        <ImageUploader
          attachments={attachments}
          isUploading={isUploading}
          onAddFiles={addFiles}
          onRemove={removeAttachment}
          disabled={isStreaming || disabled}
        />

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              disabled
                ? 'Workflow concluído. Inicie uma nova conversa.'
                : isStreaming
                ? 'Claude está processando...'
                : attachments.length > 0
                ? 'Adicione uma mensagem às imagens...'
                : 'Escreva sua mensagem...'
            }
            disabled={isStreaming || disabled}
            className="min-h-[44px] max-h-[200px] resize-none pr-24 rounded-xl bg-muted/50 border-border/50 focus:border-primary/50"
            rows={1}
          />

          <div className="absolute right-2 bottom-2 flex gap-1">
            {hasSpeechRecognition && !isStreaming && (
              <Button
                size="icon"
                variant={isListening ? 'destructive' : 'ghost'}
                onClick={toggleListening}
                disabled={disabled}
                title={isListening ? 'Parar gravação' : 'Gravar voz'}
                className="h-8 w-8"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={onCancel} className="h-8 w-8">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!canSend}
                className="h-8 w-8"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {isListening && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-2 max-w-4xl mx-auto">
          <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          Gravando - fale agora
        </p>
      )}
    </div>
  )
}
