// Speech-to-Text service using Groq Whisper API
// Baseado no smart-notes/lib/speech/groq-speech-service.ts

class GroqSpeechService {
  constructor(options = {}) {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.isListening = false;
    this.callbacks = {};
    this.chunkDuration = options.chunkDuration || 4000; // 4 seconds
    this.audioChunks = [];
    this.recordingInterval = null;
    this.accumulatedText = "";
    this.language = options.language || 'pt';
    this.hasSentFinalResult = false;
  }

  async start(callbacks) {
    if (this.isListening) {
      return true;
    }

    this.callbacks = callbacks;
    this.accumulatedText = "";
    this.hasSentFinalResult = false;

    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });

      // Determine best supported format
      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunk();
        }
        if (!this.isListening) {
          this.sendFinalResultAndEnd();
        }
      };

      // Start recording
      this.mediaRecorder.start();
      this.isListening = true;
      this.callbacks.onStart?.();

      // Set up interval to process chunks periodically
      this.recordingInterval = setInterval(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          this.audioChunks = [];
          this.mediaRecorder.start();
        }
      }, this.chunkDuration);

      return true;
    } catch (error) {
      console.error('Failed to start Groq speech recognition:', error);

      let errorMessage = 'Falha ao iniciar reconhecimento';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissao de microfone negada';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhum microfone encontrado';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microfone em uso por outro aplicativo';
      }

      this.callbacks.onError?.(errorMessage);
      return false;
    }
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  async processAudioChunk() {
    if (this.audioChunks.length === 0) return;

    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });

    // Skip very small chunks (likely silence)
    if (audioBlob.size < 1000) {
      return;
    }

    try {
      // Show interim result while processing
      this.callbacks.onResult?.(this.accumulatedText + "...", false);

      const formData = new FormData();
      const extension = mimeType.includes('webm') ? 'webm' :
                       mimeType.includes('ogg') ? 'ogg' :
                       mimeType.includes('mp4') ? 'm4a' : 'webm';
      formData.append('audio', audioBlob, `recording.${extension}`);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao transcrever audio');
      }

      const data = await response.json();

      if (data.text) {
        const newText = data.text.trim();
        if (newText) {
          if (this.accumulatedText) {
            this.accumulatedText += " " + newText;
          } else {
            this.accumulatedText = newText;
          }

          if (this.isListening) {
            this.callbacks.onResult?.(this.accumulatedText, false);
          }
        }
      }
    } catch (error) {
      console.error('Transcription error:', error);
    }
  }

  stop() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    this.isListening = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else {
      this.sendFinalResultAndEnd();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  sendFinalResultAndEnd() {
    if (this.hasSentFinalResult) return;
    this.hasSentFinalResult = true;

    if (this.accumulatedText) {
      this.callbacks.onResult?.(this.accumulatedText, true);
    }

    this.callbacks.onEnd?.();
  }

  abort() {
    this.accumulatedText = "";
    this.stop();
  }

  getIsListening() {
    return this.isListening;
  }
}

// Check if browser supports MediaRecorder
function isGroqSpeechSupported() {
  if (typeof window === 'undefined') return false;
  return 'MediaRecorder' in window && 'mediaDevices' in navigator;
}

// Singleton instance
let speechServiceInstance = null;

function getSpeechService() {
  if (!speechServiceInstance) {
    speechServiceInstance = new GroqSpeechService({
      language: 'pt',
      chunkDuration: 4000,
    });
  }
  return speechServiceInstance;
}
