import { spawn } from 'child_process';
import { getSystemPrompt, getContextNotes, getMemoryNotes } from './smart-notes.js';

// Store active processes for cancellation
const activeProcesses = new Map();

/**
 * Cancel an active Claude process
 * @param {string} processId - ID of the process to cancel
 * @returns {boolean} Whether the process was found and killed
 */
export function cancelClaudeProcess(processId) {
  const process = activeProcesses.get(processId);
  if (process) {
    process.kill('SIGTERM');
    activeProcesses.delete(processId);
    return true;
  }
  return false;
}

/**
 * Get list of active process IDs
 * @returns {string[]} Array of active process IDs
 */
export function getActiveProcesses() {
  return Array.from(activeProcesses.keys());
}

/**
 * Executa uma mensagem no Claude CLI com suporte a sessões nativas
 * @param {object} options - Opções de execução
 * @param {string} options.baseUrl - URL base do endpoint Claude
 * @param {string} options.message - Mensagem do usuário
 * @param {string} options.systemPrompt - Prompt de sistema opcional (texto direto)
 * @param {string} options.systemPromptNoteId - ID da nota do Smart Notes com system prompt
 * @param {string[]} options.contextNoteIds - IDs das notas de contexto do Smart Notes
 * @param {string[]} options.memoryNoteIds - IDs das notas de memória do Smart Notes
 * @param {string} options.projectPath - Caminho do projeto para executar o Claude
 * @param {string} options.claudeSessionId - ID da sessão Claude para continuar (null para nova sessão)
 * @param {string[]} options.initialContext - Contexto inicial para nova sessão (mensagens do step anterior)
 * @param {string} options.processId - ID do processo para cancelamento
 * @param {function} options.onData - Callback para streaming de dados
 * @returns {Promise<{content: string, sessionId: string, actions: array, error?: string, cancelled?: boolean}>}
 */
export async function executeClaudeWithSession(options) {
  const {
    baseUrl,
    message,
    systemPrompt = null,
    systemPromptNoteId = null,
    contextNoteIds = [],
    memoryNoteIds = [],
    projectPath = null,
    claudeSessionId = null,
    initialContext = [],
    processId = null,
    onData = null,
  } = options;

  // Build the final system prompt from Smart Notes and/or direct text
  let finalSystemPrompt = systemPrompt || '';

  // Fetch system prompt from Smart Notes if provided
  if (systemPromptNoteId) {
    try {
      const notePrompt = await getSystemPrompt(systemPromptNoteId);
      if (notePrompt) {
        finalSystemPrompt = notePrompt;
      }
    } catch (error) {
      console.error('Error fetching system prompt from Smart Notes:', error.message);
    }
  }

  // Fetch and prepend context notes
  if (contextNoteIds && contextNoteIds.length > 0) {
    try {
      const contextContent = await getContextNotes(contextNoteIds);
      if (contextContent) {
        finalSystemPrompt = contextContent + '\n\n---\n\n' + finalSystemPrompt;
      }
    } catch (error) {
      console.error('Error fetching context notes:', error.message);
    }
  }

  // Fetch and prepend memory notes
  if (memoryNoteIds && memoryNoteIds.length > 0) {
    try {
      const memoryContent = await getMemoryNotes(memoryNoteIds);
      if (memoryContent) {
        finalSystemPrompt = memoryContent + '\n\n---\n\n' + finalSystemPrompt;
      }
    } catch (error) {
      console.error('Error fetching memory notes:', error.message);
    }
  }

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: baseUrl,
    };

    // Usar JSON para capturar session_id, ou stream-json para streaming
    const outputFormat = onData ? 'stream-json' : 'json';

    const args = [
      '--print',
      '--output-format', outputFormat,
      '--dangerously-skip-permissions',
    ];

    // stream-json com --print requer --verbose
    if (outputFormat === 'stream-json') {
      args.push('--verbose');
    }

    // Se já tem sessão, usar --resume para continuar
    if (claudeSessionId) {
      args.push('--resume', claudeSessionId);
    }

    if (finalSystemPrompt) {
      args.push('--system-prompt', finalSystemPrompt);
    }

    const spawnOptions = { env };
    if (projectPath) {
      spawnOptions.cwd = projectPath;
    }

    const claude = spawn('claude', args, spawnOptions);

    // Register for cancellation
    const pid = processId || `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activeProcesses.set(pid, claude);

    let fullContent = '';
    let stderr = '';
    let actions = [];
    let buffer = '';
    let capturedSessionId = claudeSessionId; // Manter o existente ou capturar novo

    claude.stdout.on('data', (data) => {
      buffer += data.toString();

      if (onData) {
        // Modo streaming - processar linha por linha
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          processStreamLine(line);
        }
      }
    });

    function processStreamLine(line) {
      try {
        const parsed = JSON.parse(line);

        // Capturar session_id se disponível
        if (parsed.session_id && !capturedSessionId) {
          capturedSessionId = parsed.session_id;
          if (onData) {
            onData({ type: 'session', sessionId: capturedSessionId });
          }
        }

        // Handle Claude CLI message format (full message object)
        if (parsed.type === 'message' && Array.isArray(parsed.content)) {
          for (const block of parsed.content) {
            if (block.type === 'text' && block.text) {
              fullContent += block.text;
              if (onData) {
                onData({ type: 'content', content: block.text });
              }
            } else if (block.type === 'thinking' && block.thinking) {
              const action = {
                type: 'thinking',
                content: block.thinking,
              };
              actions.push(action);
              if (onData) {
                onData({ type: 'action', action });
              }
            } else if (block.type === 'tool_use') {
              const action = {
                type: 'tool_use',
                name: block.name || 'unknown',
                input: block.input || {},
                id: block.id,
              };
              actions.push(action);
              if (onData) {
                onData({ type: 'action', action });
              }
            } else if (block.type === 'tool_result') {
              const action = {
                type: 'tool_result',
                name: block.name || 'tool',
                output: block.content || block.output || '',
                id: block.tool_use_id,
              };
              actions.push(action);
              if (onData) {
                onData({ type: 'action', action });
              }
            }
          }
        }
        // Handle assistant message format
        else if (parsed.type === 'assistant' && parsed.message) {
          fullContent += parsed.message;
          if (onData) {
            onData({ type: 'content', content: parsed.message });
          }
        }
        // Handle content block streaming
        else if (parsed.type === 'content_block_start' || parsed.type === 'content_block_delta') {
          const text = parsed.content_block?.text || parsed.delta?.text || '';
          if (text) {
            fullContent += text;
            if (onData) {
              onData({ type: 'content', content: text });
            }
          }
        }
        // Handle tool use event
        else if (parsed.type === 'tool_use' || parsed.tool_name) {
          const action = {
            type: 'tool_use',
            name: parsed.tool_name || parsed.name || 'unknown',
            input: parsed.tool_input || parsed.input || {},
          };
          actions.push(action);
          if (onData) {
            onData({ type: 'action', action });
          }
        }
        // Handle tool result event
        else if (parsed.type === 'tool_result') {
          const action = {
            type: 'tool_result',
            name: parsed.tool_name || 'unknown',
            output: parsed.output || parsed.result || '',
          };
          actions.push(action);
          if (onData) {
            onData({ type: 'action', action });
          }
        }
        // Handle result/final event - captura session_id aqui também
        else if (parsed.type === 'result') {
          if (parsed.session_id) {
            capturedSessionId = parsed.session_id;
          }
          if (parsed.result && typeof parsed.result === 'string') {
            fullContent = parsed.result;
          }
          if (onData) {
            onData({ type: 'done', content: fullContent, actions, sessionId: capturedSessionId });
          }
        }
        // Handle error event
        else if (parsed.type === 'error') {
          const action = {
            type: 'error',
            message: parsed.error || parsed.message || 'Unknown error',
          };
          actions.push(action);
          if (onData) {
            onData({ type: 'action', action });
          }
        }
      } catch {
        // Not JSON, might be raw text output
        if (line.trim()) {
          fullContent += line;
          if (onData) {
            onData({ type: 'content', content: line });
          }
        }
      }
    }

    claude.stderr.on('data', (data) => {
      const stderrContent = data.toString();
      stderr += stderrContent;

      // Filtrar apenas avisos de pre-flight check (manter erros reais)
      const isPreflightWarning = stderrContent.includes('Pre-flight check is taking longer than expected');

      if (onData && !isPreflightWarning) {
        onData({ type: 'action', action: { type: 'stderr', content: stderrContent } });
      }
    });

    claude.on('close', (code, signal) => {
      activeProcesses.delete(pid);

      // Processar buffer restante
      if (buffer.trim()) {
        if (onData) {
          processStreamLine(buffer);
        } else {
          // Modo JSON - parse completo
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.session_id) {
              capturedSessionId = parsed.session_id;
            }
            if (parsed.result) {
              fullContent = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result);
            }
          } catch {
            fullContent += buffer;
          }
        }
      }

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        if (onData) {
          onData({ type: 'cancelled' });
        }
        resolve({
          content: fullContent,
          sessionId: capturedSessionId,
          actions,
          cancelled: true,
        });
      } else if (code !== 0 && !fullContent) {
        resolve({
          content: '',
          sessionId: capturedSessionId,
          actions,
          error: stderr || `Claude CLI exited with code ${code}`,
        });
      } else {
        resolve({
          content: fullContent,
          sessionId: capturedSessionId,
          actions,
        });
      }
    });

    claude.on('error', (error) => {
      activeProcesses.delete(pid);
      reject(error);
    });

    // Construir prompt
    let fullPrompt = '';

    // Se é primeira mensagem e tem contexto inicial (do step anterior), incluir
    if (!claudeSessionId && initialContext.length > 0) {
      fullPrompt = `Contexto do step anterior:\n${initialContext.join('\n\n')}\n\n---\n\nMensagem atual:\n`;
    }

    fullPrompt += message;

    claude.stdin.write(fullPrompt);
    claude.stdin.end();
  });
}

// Manter funções antigas para compatibilidade (deprecated)
export async function executeClaudeMessage(baseUrl, message, context = [], systemPrompt = null, processId = null, projectPath = null) {
  const result = await executeClaudeWithSession({
    baseUrl,
    message,
    systemPrompt,
    projectPath,
    processId,
    initialContext: context,
  });
  return {
    content: result.content,
    error: result.error,
    cancelled: result.cancelled,
  };
}

export async function executeClaudeMessageStream(baseUrl, message, context = [], systemPrompt = null, onData, processId = null, projectPath = null) {
  const result = await executeClaudeWithSession({
    baseUrl,
    message,
    systemPrompt,
    projectPath,
    processId,
    initialContext: context,
    onData,
  });
  return {
    content: result.content,
    actions: result.actions,
    error: result.error,
    cancelled: result.cancelled,
  };
}

export default {
  executeClaudeWithSession,
  executeClaudeMessage,
  executeClaudeMessageStream,
  cancelClaudeProcess,
  getActiveProcesses
};
