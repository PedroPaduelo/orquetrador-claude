import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

function getMimeType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'ogg': 'audio/ogg',
    'm4a': 'audio/m4a',
    'mp4': 'audio/mp4',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
  };
  return mimeTypes[ext || ''] || 'audio/mpeg';
}

export default async function transcribeRoutes(fastify) {
  // POST /api/transcribe - Transcribe audio file
  fastify.post('/api/transcribe', async (request, reply) => {
    if (!process.env.GROQ_API_KEY) {
      return reply.status(503).send({
        error: 'Transcrição não configurada. Adicione GROQ_API_KEY no .env'
      });
    }

    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'Nenhum arquivo de áudio enviado' });
      }

      const buffer = await data.toBuffer();
      const fileName = data.filename || 'audio.webm';

      // Convert Buffer to File for Groq API
      const uint8Array = new Uint8Array(buffer);
      const file = new File([uint8Array], fileName, { type: getMimeType(fileName) });

      const transcription = await groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        language: 'pt',
        response_format: 'verbose_json',
      });

      return reply.send({
        text: transcription.text || '',
        success: true,
      });
    } catch (error) {
      console.error('Transcription error:', error);
      return reply.status(500).send({
        error: error.message || 'Falha ao transcrever áudio',
        success: false,
      });
    }
  });
}
