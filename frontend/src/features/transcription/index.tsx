import { Mic } from 'lucide-react'
import { AudioRecorder } from './components/audio-recorder'

export default function TranscriptionPage() {
  return (
    <div className="container py-6 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Mic className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Transcricao</h1>
        </div>
        <p className="text-muted-foreground">
          Converta audio em texto usando Groq Whisper API
        </p>
      </div>

      <AudioRecorder />
    </div>
  )
}
