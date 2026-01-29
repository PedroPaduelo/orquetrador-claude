/**
 * Smart Notes Integration Service
 *
 * Integra com o Smart Notes via MCP (Model Context Protocol).
 * URL: https://smart-notes-smart-notes.mrt7ga.easypanel.host/
 *
 * Configurável via variáveis de ambiente:
 * - SMART_NOTES_API_URL: URL base da API
 * - SMART_NOTES_API_KEY: Chave MCP para autenticação (x-api-key header)
 */

const SMART_NOTES_API_URL = process.env.SMART_NOTES_API_URL || 'https://smart-notes-smart-notes.mrt7ga.easypanel.host';
const SMART_NOTES_API_KEY = process.env.SMART_NOTES_API_KEY || '';

let requestId = 1;

/**
 * Executa uma ferramenta via MCP (JSON-RPC 2.0)
 * @param {string} toolName - Nome da ferramenta (ex: 'get_note', 'list_folders')
 * @param {object} args - Argumentos da ferramenta
 * @returns {Promise<any>} - Resultado da execução
 */
async function mcpExecute(toolName, args = {}) {
  const url = `${SMART_NOTES_API_URL}/api/mcp/execute`;

  const payload = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SMART_NOTES_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`MCP request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // MCP response has result.content array with text items
    if (data.result && data.result.content) {
      const textContent = data.result.content.find(c => c.type === 'text');
      if (textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }

    return data.result;
  } catch (error) {
    console.error(`MCP execute failed: ${toolName}`, error.message);
    throw error;
  }
}

/**
 * Busca o conteúdo de uma nota pelo ID
 * @param {string} noteId - ID da nota
 * @returns {Promise<{id: string, title: string, content: string, tags: array} | null>}
 */
export async function getNoteContent(noteId) {
  if (!noteId) return null;

  try {
    const result = await mcpExecute('get_note', { id: noteId });
    return result || null;
  } catch (error) {
    console.error(`Error fetching note ${noteId}:`, error.message);
    return null;
  }
}

/**
 * Lista todas as notas, opcionalmente filtradas por pasta
 * @param {string} folderId - ID da pasta (opcional)
 * @returns {Promise<array>}
 */
export async function listNotesByFolder(folderId = null) {
  try {
    const args = {};
    if (folderId) {
      args.folderId = folderId;
    }
    const result = await mcpExecute('list_notes', args);
    return result?.notes || result || [];
  } catch (error) {
    console.error('Error listing notes:', error.message);
    return [];
  }
}

/**
 * Lista todas as pastas como árvore
 * @returns {Promise<array>}
 */
export async function listFolders() {
  try {
    const result = await mcpExecute('list_folders', { asTree: 'true' });
    return result || [];
  } catch (error) {
    console.error('Error listing folders:', error.message);
    return [];
  }
}

/**
 * Busca notas por termo de pesquisa
 * @param {string} query - Termo de busca
 * @returns {Promise<array>}
 */
export async function searchNotes(query) {
  if (!query) return [];

  try {
    const result = await mcpExecute('search_notes', { query });
    return result?.notes || result || [];
  } catch (error) {
    console.error('Error searching notes:', error.message);
    return [];
  }
}

/**
 * Busca o system prompt de uma nota
 * @param {string} noteId - ID da nota
 * @returns {Promise<string | null>}
 */
export async function getSystemPrompt(noteId) {
  const note = await getNoteContent(noteId);
  if (!note) {
    return null;
  }
  return note.content;
}

/**
 * Busca e concatena múltiplas notas de contexto
 * @param {string[]} noteIds - Array de IDs de notas
 * @returns {Promise<string>}
 */
export async function getContextNotes(noteIds) {
  if (!noteIds || noteIds.length === 0) {
    return '';
  }

  const notes = await Promise.all(
    noteIds.map(id => getNoteContent(id))
  );

  const validNotes = notes.filter(n => n && n.content);

  if (validNotes.length === 0) {
    return '';
  }

  return validNotes
    .map(note => `## ${note.title}\n\n${note.content}`)
    .join('\n\n---\n\n');
}

/**
 * Busca notas de memória e formata como contexto
 * @param {string[]} noteIds - Array de IDs de notas de memória
 * @returns {Promise<string>}
 */
export async function getMemoryNotes(noteIds) {
  if (!noteIds || noteIds.length === 0) {
    return '';
  }

  const notes = await Promise.all(
    noteIds.map(id => getNoteContent(id))
  );

  const validNotes = notes.filter(n => n && n.content);

  if (validNotes.length === 0) {
    return '';
  }

  return '## Memória do Projeto\n\n' + validNotes
    .map(note => `### ${note.title}\n${note.content}`)
    .join('\n\n');
}

/**
 * Busca múltiplas notas em paralelo e retorna um objeto com os resultados
 * @param {Object} options - IDs das notas para cada tipo
 * @param {string} options.systemPromptNoteId - ID da nota de system prompt
 * @param {string[]} options.contextNoteIds - IDs das notas de contexto
 * @param {string[]} options.memoryNoteIds - IDs das notas de memória
 * @returns {Promise<{systemPrompt: string, context: string, memory: string}>}
 */
export async function fetchAllNotes({ systemPromptNoteId, contextNoteIds = [], memoryNoteIds = [] }) {
  const [systemPrompt, context, memory] = await Promise.all([
    systemPromptNoteId ? getSystemPrompt(systemPromptNoteId) : Promise.resolve(null),
    getContextNotes(contextNoteIds),
    getMemoryNotes(memoryNoteIds),
  ]);

  return {
    systemPrompt: systemPrompt || '',
    context,
    memory,
  };
}

/**
 * Verifica se a API do Smart Notes está acessível
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${SMART_NOTES_API_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Retorna a URL base da API configurada
 * @returns {string}
 */
export function getApiUrl() {
  return SMART_NOTES_API_URL;
}

/**
 * Verifica se a API key está configurada
 * @returns {boolean}
 */
export function hasApiKey() {
  return !!SMART_NOTES_API_KEY;
}

export default {
  getNoteContent,
  listNotesByFolder,
  listFolders,
  searchNotes,
  getSystemPrompt,
  getContextNotes,
  getMemoryNotes,
  fetchAllNotes,
  checkConnection,
  getApiUrl,
  hasApiKey,
};
