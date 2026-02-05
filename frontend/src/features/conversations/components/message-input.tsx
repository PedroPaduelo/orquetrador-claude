import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Mic, MicOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'

interface MessageInputProps {
  onSend: (content: string) => void
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

export function MessageInput({ onSend, onCancel, isStreaming, disabled }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const handleSubmit = () => {
    if (!content.trim() || isStreaming || disabled) return
    onSend(content.trim())
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

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
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
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

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? 'Workflow finalizado'
                : isStreaming
                ? 'Aguardando resposta...'
                : 'Digite sua mensagem...'
            }
            disabled={isStreaming || disabled}
            className="min-h-[44px] max-h-[200px] resize-none pr-24"
            rows={1}
          />

          <div className="absolute right-2 bottom-2 flex gap-1">
            {hasSpeechRecognition && !isStreaming && (
              <Button
                size="icon"
                variant={isListening ? 'destructive' : 'outline'}
                onClick={toggleListening}
                disabled={disabled}
                title={isListening ? 'Parar gravação' : 'Gravar voz'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={onCancel}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!content.trim() || disabled}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {isStreaming && (
        <p className="text-xs text-muted-foreground mt-2">
          Processando... Clique no botão para cancelar.
        </p>
      )}
      {isListening && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Gravando... Fale agora
        </p>
      )}
    </div>
  )
}
