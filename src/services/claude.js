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

// Instruções padrão para lidar com comandos long-running
const LONG_RUNNING_INSTRUCTIONS = `
IMPORTANTE - Comandos Long-Running:
Quando precisar executar comandos que rodam indefinidamente (servidores, watch mode, etc):
- Use 'run_in_background: true' no Bash tool
- Exemplos: npm run dev, yarn start, python -m http.server, docker-compose up
- NUNCA execute esses comandos em foreground pois travará a execução
- Após iniciar em background, verifique se o processo iniciou corretamente
- Informe ao usuário como verificar os logs ou parar o processo
`;

// Timeout padrão para execuções (5 minutos)
const DEFAULT_EXECUTION_TIMEOUT = 5 * 60 * 1000;

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
 * @param {number} options.timeout - Timeout em ms (padrão: 5 minutos)
 * @returns {Promise<{content: string, sessionId: string, actions: array, error?: string, cancelled?: boolean, timedOut?: boolean}>}
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
    timeout = DEFAULT_EXECUTION_TIMEOUT,
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

  // Sempre adicionar instruções para comandos long-running
  finalSystemPrompt = LONG_RUNNING_INSTRUCTIONS + '\n\n' + finalSystemPrompt;

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
      '--max-turns', '50',  // Limite de iterações para evitar loops infinitos
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
    let timedOut = false;
    let lastActivityTime = Date.now();

    // Timeout handler - mata o processo se ficar muito tempo sem atividade
    const timeoutCheck = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime;
      if (inactiveTime > timeout) {
        console.log(`[Claude] Timeout após ${timeout}ms de inatividade. Matando processo.`);
        timedOut = true;
        claude.kill('SIGTERM');
        clearInterval(timeoutCheck);
      }
    }, 5000); // Verifica a cada 5 segundos

    claude.stdout.on('data', (data) => {
      lastActivityTime = Date.now(); // Reset timeout on activity
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

        // DEBUG: Log TODO o JSON recebido para entender o formato
        console.log(`[Claude Stream] RAW: ${line.substring(0, 500)}`);

        // Capturar session_id se disponível (pode estar em vários lugares)
        const sessionId = parsed.session_id || parsed.sessionId;
        if (sessionId && !capturedSessionId) {
          capturedSessionId = sessionId;
          if (onData) {
            onData({ type: 'session', sessionId: capturedSessionId });
          }
        }

        // Função helper para extrair ações de um array de content blocks
        function extractActionsFromContent(contentArray) {
          if (!Array.isArray(contentArray)) return;

          for (const block of contentArray) {
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
              console.log(`[Claude] Ação capturada: thinking`);
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
              console.log(`[Claude] Ação capturada: tool_use - ${action.name}`);
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
              console.log(`[Claude] Ação capturada: tool_result`);
              if (onData) {
                onData({ type: 'action', action });
              }
            }
          }
        }

        // Handle Claude CLI assistant message format: { type: "assistant", message: { content: [...] } }
        if (parsed.type === 'assistant' && parsed.message) {
          if (typeof parsed.message === 'object' && Array.isArray(parsed.message.content)) {
            console.log(`[Claude] Processando assistant message com ${parsed.message.content.length} blocos`);
            extractActionsFromContent(parsed.message.content);
          } else if (typeof parsed.message === 'string') {
            fullContent += parsed.message;
            if (onData) {
              onData({ type: 'content', content: parsed.message });
            }
          }
        }
        // Handle Claude CLI user message format (contém tool_result): { type: "user", message: { content: [...] } }
        else if (parsed.type === 'user' && parsed.message && Array.isArray(parsed.message.content)) {
          console.log(`[Claude] Processando user message (tool_result) com ${parsed.message.content.length} blocos`);
          // Extrair tool_result
          for (const block of parsed.message.content) {
            if (block.type === 'tool_result') {
              const action = {
                type: 'tool_result',
                name: 'tool',
                output: block.content || '',
                id: block.tool_use_id,
              };
              actions.push(action);
              console.log(`[Claude] Ação capturada: tool_result para ${block.tool_use_id}`);
              if (onData) {
                onData({ type: 'action', action });
              }
            }
          }
        }
        // Handle legacy format: { type: "message", content: [...] }
        else if (parsed.type === 'message' && Array.isArray(parsed.content)) {
          extractActionsFromContent(parsed.content);
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
          // Capturar tool_use de content_block_start
          if (parsed.content_block?.type === 'tool_use') {
            const action = {
              type: 'tool_use',
              name: parsed.content_block.name || 'unknown',
              input: parsed.content_block.input || {},
              id: parsed.content_block.id,
            };
            actions.push(action);
            console.log(`[Claude] Ação capturada (content_block): tool_use - ${action.name}`);
            if (onData) {
              onData({ type: 'action', action });
            }
          }
        }
        // Handle tool use event (standalone)
        else if (parsed.type === 'tool_use' || parsed.tool_name) {
          const action = {
            type: 'tool_use',
            name: parsed.tool_name || parsed.name || 'unknown',
            input: parsed.tool_input || parsed.input || {},
            id: parsed.id,
          };
          actions.push(action);
          console.log(`[Claude] Ação capturada (standalone): tool_use - ${action.name}`);
          if (onData) {
            onData({ type: 'action', action });
          }
        }
        // Handle tool result event (standalone)
        else if (parsed.type === 'tool_result') {
          const action = {
            type: 'tool_result',
            name: parsed.tool_name || parsed.name || 'unknown',
            output: parsed.output || parsed.content || parsed.result || '',
            id: parsed.tool_use_id || parsed.id,
          };
          actions.push(action);
          console.log(`[Claude] Ação capturada (standalone): tool_result`);
          if (onData) {
            onData({ type: 'action', action });
          }
        }
        // Handle result/final event
        else if (parsed.type === 'result') {
          if (parsed.session_id) {
            capturedSessionId = parsed.session_id;
          }
          // Extrair ações do resultado final se existirem
          if (parsed.messages && Array.isArray(parsed.messages)) {
            for (const msg of parsed.messages) {
              if (msg.content && Array.isArray(msg.content)) {
                extractActionsFromContent(msg.content);
              }
            }
          }
          if (parsed.result && typeof parsed.result === 'string') {
            fullContent = parsed.result;
          }
          if (onData) {
            onData({ type: 'done', content: fullContent, actions, sessionId: capturedSessionId });
          }
        }
        // Handle system event (pode conter informações úteis)
        else if (parsed.type === 'system') {
          console.log(`[Claude] System event: ${JSON.stringify(parsed).substring(0, 200)}`);
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
        // Log eventos não tratados para debug
        else {
          console.log(`[Claude] Evento não tratado: type=${parsed.type}, keys=${Object.keys(parsed).join(', ')}`);
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
      lastActivityTime = Date.now(); // Reset timeout on activity
      const stderrContent = data.toString();
      stderr += stderrContent;

      // Filtrar apenas avisos de pre-flight check (manter erros reais)
      const isPreflightWarning = stderrContent.includes('Pre-flight check is taking longer than expected');

      if (onData && !isPreflightWarning) {
        onData({ type: 'action', action: { type: 'stderr', content: stderrContent } });
      }
    });

    claude.on('close', (code, signal) => {
      clearInterval(timeoutCheck); // Limpar timeout check
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

      // Log das ações coletadas para debug
      console.log(`[Claude] Processo finalizado. Ações coletadas: ${actions.length}`);
      if (actions.length > 0) {
        console.log(`[Claude] Tipos de ações: ${actions.map(a => a.type).join(', ')}`);
      }

      if (timedOut) {
        if (onData) {
          onData({ type: 'timeout', message: 'Execução excedeu o tempo limite' });
        }
        resolve({
          content: fullContent || 'Execução excedeu o tempo limite. Verifique se o comando está rodando em background.',
          sessionId: capturedSessionId,
          actions,
          timedOut: true,
        });
      } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
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
