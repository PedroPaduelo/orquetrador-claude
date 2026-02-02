import { useState } from 'react'
import { Mic, MicOff, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useTranscription } from '../hooks/use-transcription'
import { cn } from '@/shared/lib/utils'

const LANGUAGES = [
  { code: 'pt', name: 'Portugues' },
  { code: 'en', name: 'Ingles' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Frances' },
  { code: 'de', name: 'Alemao' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japones' },
  { code: 'ko', name: 'Coreano' },
  { code: 'zh', name: 'Chines' },
]

interface AudioRecorderProps {
  onTranscription?: (text: string) => void
}

export function AudioRecorder({ onTranscription }: AudioRecorderProps) {
  const [language, setLanguage] = useState('pt')
  const [prompt, setPrompt] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<string>('')

  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    transcribe,
    transcribeFile,
  } = useTranscription()

  const handleRecordToggle = async () => {
    if (isRecording) {
      const blob = await stopRecording()
      const result = await transcribe(blob, { language, prompt: prompt || undefined })
      setTranscriptionResult(result.text)
      onTranscription?.(result.text)
    } else {
      await startRecording()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileTranscribe = async () => {
    if (!selectedFile) return
    const result = await transcribeFile(selectedFile, { language, prompt: prompt || undefined })
    setTranscriptionResult(result.text)
    onTranscription?.(result.text)
    setSelectedFile(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcricao de Audio</CardTitle>
        <CardDescription>
          Grave ou envie um arquivo de audio para transcricao
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="space-y-2">
          <Label>Idioma</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Label>Contexto (opcional)</Label>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Palavras-chave ou contexto do audio..."
          />
        </div>

        {/* Recording Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant={isRecording ? 'destructive' : 'default'}
            size="lg"
            onClick={handleRecordToggle}
            disabled={isTranscribing}
            className={cn(isRecording && 'animate-pulse')}
          >
            {isTranscribing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="mr-2 h-5 w-5" />
            ) : (
              <Mic className="mr-2 h-5 w-5" />
            )}
            {isTranscribing
              ? 'Transcrevendo...'
              : isRecording
              ? 'Parar Gravacao'
              : 'Iniciar Gravacao'}
          </Button>

          <div className="text-muted-foreground">ou</div>

          {/* File Upload */}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <Label
              htmlFor="audio-upload"
              className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border rounded-md hover:bg-muted"
            >
              <Upload className="mr-2 h-4 w-4" />
              Enviar Arquivo
            </Label>

            {selectedFile && (
              <div className="flex items-center gap-2 text-sm">
                <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleFileTranscribe}
                  disabled={isTranscribing}
                >
                  Transcrever
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Transcription Result */}
        {transcriptionResult && (
          <div className="space-y-2">
            <Label>Transcricao</Label>
            <Textarea
              value={transcriptionResult}
              readOnly
              className="min-h-[150px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(transcriptionResult)}
            >
              Copiar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
