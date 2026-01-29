import smartNotes from '../services/smart-notes.js';

export default async function smartNotesRoutes(fastify) {
  // Check Smart Notes connection status
  fastify.get('/api/smart-notes/status', async (request, reply) => {
    const connected = await smartNotes.checkConnection();
    return {
      connected,
      apiUrl: smartNotes.getApiUrl(),
      hasApiKey: smartNotes.hasApiKey(),
    };
  });

  // List all folders
  fastify.get('/api/smart-notes/folders', async (request, reply) => {
    try {
      const folders = await smartNotes.listFolders();
      return folders;
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch folders: ' + error.message });
    }
  });

  // List notes (optionally filtered by folder)
  fastify.get('/api/smart-notes/notes', async (request, reply) => {
    try {
      const { folderId } = request.query;
      const notes = await smartNotes.listNotesByFolder(folderId || null);
      return notes;
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch notes: ' + error.message });
    }
  });

  // Search notes
  fastify.get('/api/smart-notes/notes/search', async (request, reply) => {
    try {
      const { q } = request.query;
      if (!q) {
        return reply.status(400).send({ error: 'Query parameter "q" is required' });
      }
      const notes = await smartNotes.searchNotes(q);
      return notes;
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to search notes: ' + error.message });
    }
  });

  // Get single note by ID
  fastify.get('/api/smart-notes/notes/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const note = await smartNotes.getNoteContent(id);
      if (!note) {
        return reply.status(404).send({ error: 'Note not found' });
      }
      return note;
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch note: ' + error.message });
    }
  });

  // Get multiple notes by IDs (for preview)
  fastify.post('/api/smart-notes/notes/batch', async (request, reply) => {
    try {
      const { ids } = request.body;
      if (!ids || !Array.isArray(ids)) {
        return reply.status(400).send({ error: 'ids array is required' });
      }

      const notes = await Promise.all(
        ids.map(id => smartNotes.getNoteContent(id))
      );

      return notes.filter(n => n !== null);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch notes: ' + error.message });
    }
  });

  // Preview combined context from multiple notes
  fastify.post('/api/smart-notes/preview-context', async (request, reply) => {
    try {
      const { contextNoteIds, memoryNoteIds, systemPromptNoteId } = request.body;

      let preview = '';

      // Memory notes
      if (memoryNoteIds && memoryNoteIds.length > 0) {
        const memoryContent = await smartNotes.getMemoryNotes(memoryNoteIds);
        if (memoryContent) {
          preview += memoryContent + '\n\n---\n\n';
        }
      }

      // Context notes
      if (contextNoteIds && contextNoteIds.length > 0) {
        const contextContent = await smartNotes.getContextNotes(contextNoteIds);
        if (contextContent) {
          preview += contextContent + '\n\n---\n\n';
        }
      }

      // System prompt
      if (systemPromptNoteId) {
        const systemPrompt = await smartNotes.getSystemPrompt(systemPromptNoteId);
        if (systemPrompt) {
          preview += '## System Prompt\n\n' + systemPrompt;
        }
      }

      return {
        preview: preview.trim(),
        characterCount: preview.length,
        tokenEstimate: Math.ceil(preview.length / 4), // Rough estimate
      };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to preview context: ' + error.message });
    }
  });
}
