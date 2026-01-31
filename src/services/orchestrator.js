/**
 * TaskOrchestrator - Orquestração centralizada inspirada no vibe-kanban
 *
 * Padrões aplicados:
 * - Estado de execução persistente (não perde no restart)
 * - Mensagens em três níveis: user → pending → confirmed
 * - Catálogo de erros centralizado
 * - Event bus para atualizações reativas
 * - Retry com backoff exponencial
 */

import { query, getClient } from './database.js';
import { executeClaudeWithSession, cancelClaudeProcess } from './claude.js';
import { evaluateConditions, resolveNextStep, formatRetryMessage } from './conditions.js';
import EventEmitter from 'events';

// Event Bus global para comunicação reativa
export const orchestratorEvents = new EventEmitter();
orchestratorEvents.setMaxListeners(100);

// Catálogo de erros centralizado (inspirado no vibe-kanban)
export const ErrorCatalog = {
  CONVERSATION_NOT_FOUND: { code: 'E001', status: 404, message: 'Conversation not found' },
  WORKFLOW_NO_STEPS: { code: 'E002', status: 400, message: 'Workflow has no steps' },
  STEP_NOT_FOUND: { code: 'E003', status: 404, message: 'Current step not found' },
  EXECUTION_IN_PROGRESS: { code: 'E004', status: 409, message: 'Execution already in progress' },
  EXECUTION_NOT_FOUND: { code: 'E005', status: 404, message: 'No active execution found' },
  MAX_RETRIES_EXCEEDED: { code: 'E006', status: 422, message: 'Maximum retries exceeded' },
  CLAUDE_ERROR: { code: 'E007', status: 502, message: 'Claude CLI error' },
  DATABASE_ERROR: { code: 'E008', status: 500, message: 'Database error' },
  CANCELLED: { code: 'E009', status: 499, message: 'Execution cancelled' },
};

// Estados de mensagem (três níveis como no vibe-kanban)
export const MessageState = {
  PENDING: 'pending',      // Mensagem sendo gerada (streaming)
  CONFIRMED: 'confirmed',  // Mensagem salva no banco
  FAILED: 'failed',        // Falha na geração
};

// Estados de execução
export const ExecutionState = {
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/**
 * TaskOrchestrator - Gerencia execuções de workflow
 */
export class TaskOrchestrator {
  constructor() {
    this.activeExecutions = new Map();
  }

  /**
   * Cria um erro padronizado
   */
  createError(errorType, details = {}) {
    const error = ErrorCatalog[errorType] || { code: 'E999', status: 500, message: 'Unknown error' };
    return {
      ...error,
      ...details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Persiste estado de execução no banco
   */
  async persistExecutionState(executionId, state) {
    await query(`
      INSERT INTO execution_state (id, conversation_id, state, current_step_index, retry_counts, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        state = $3,
        current_step_index = $4,
        retry_counts = $5,
        metadata = $6,
        updated_at = NOW()
    `, [
      executionId,
      state.conversationId,
      state.executionState,
      state.currentStepIndex,
      JSON.stringify(state.retryCounts || {}),
      JSON.stringify(state.metadata || {}),
    ]);
  }

  /**
   * Recupera estado de execução do banco
   */
  async getExecutionState(executionId) {
    const result = await query(
      'SELECT * FROM execution_state WHERE id = $1',
      [executionId]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      executionId: row.id,
      conversationId: row.conversation_id,
      executionState: row.state,
      currentStepIndex: row.current_step_index,
      retryCounts: row.retry_counts || {},
      metadata: row.metadata || {},
    };
  }

  /**
   * Gera ID único para execução
   */
  generateExecutionId(conversationId) {
    return `exec_${conversationId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Verifica se já existe execução ativa para a conversa
   */
  hasActiveExecution(conversationId) {
    for (const [, exec] of this.activeExecutions) {
      if (exec.conversationId === conversationId && exec.state === ExecutionState.RUNNING) {
        return true;
      }
    }
    return false;
  }

  /**
   * Busca contexto completo da execução
   */
  async getExecutionContext(conversationId) {
    // Buscar conversa com workflow
    const conversationResult = await query(`
      SELECT c.*, w.type as workflow_type, w.project_path, w.name as workflow_name
      FROM conversations c
      JOIN workflows w ON c.workflow_id = w.id
      WHERE c.id = $1
    `, [conversationId]);

    if (conversationResult.rows.length === 0) {
      throw this.createError('CONVERSATION_NOT_FOUND');
    }

    const conversation = conversationResult.rows[0];

    // Buscar steps do workflow
    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [conversation.workflow_id]
    );

    if (stepsResult.rows.length === 0) {
      throw this.createError('WORKFLOW_NO_STEPS');
    }

    return {
      conversation,
      steps: stepsResult.rows,
    };
  }

  /**
   * Busca ou cria sessão Claude para um step
   */
  async getOrCreateSession(conversationId, stepId) {
    const existing = await query(
      'SELECT claude_session_id FROM conversation_sessions WHERE conversation_id = $1 AND step_id = $2',
      [conversationId, stepId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].claude_session_id;
    }

    return null;
  }

  /**
   * Salva sessão Claude para um step
   */
  async saveSession(conversationId, stepId, claudeSessionId) {
    await query(`
      INSERT INTO conversation_sessions (conversation_id, step_id, claude_session_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (conversation_id, step_id)
      DO UPDATE SET claude_session_id = $3
    `, [conversationId, stepId, claudeSessionId]);
  }

  /**
   * Busca contexto inicial para novo step
   */
  async getInitialContext(conversationId) {
    const result = await query(
      'SELECT content, role FROM messages WHERE conversation_id = $1 AND selected_for_context = true ORDER BY created_at',
      [conversationId]
    );
    return result.rows.map(m => `${m.role}: ${m.content}`);
  }

  /**
   * Salva mensagem com estado (pending → confirmed)
   */
  async saveMessage(conversationId, stepId, role, content, metadata = {}, state = MessageState.CONFIRMED) {
    const result = await query(
      'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [conversationId, stepId, role, content, JSON.stringify({ ...metadata, message_state: state })]
    );

    const message = result.rows[0];

    // Emitir evento de mensagem salva
    orchestratorEvents.emit('message:saved', {
      conversationId,
      message,
      state,
    });

    return message;
  }

  /**
   * Atualiza estado de mensagem (pending → confirmed)
   */
  async confirmMessage(messageId, additionalMetadata = {}) {
    const current = await query('SELECT metadata FROM messages WHERE id = $1', [messageId]);
    if (current.rows.length === 0) return null;

    const currentMetadata = current.rows[0].metadata || {};
    const newMetadata = {
      ...currentMetadata,
      ...additionalMetadata,
      message_state: MessageState.CONFIRMED,
      confirmed_at: new Date().toISOString(),
    };

    const result = await query(
      'UPDATE messages SET metadata = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(newMetadata), messageId]
    );

    orchestratorEvents.emit('message:confirmed', {
      messageId,
      message: result.rows[0],
    });

    return result.rows[0];
  }

  /**
   * Executa um único step
   */
  async executeStep(executionId, step, input, context) {
    const { conversation, retryCounts } = context;
    const stepRetryKey = step.id;
    const currentRetryCount = retryCounts[stepRetryKey] || 0;
    const maxRetries = step.max_retries || step.conditions?.max_retries || 3;

    // Emitir evento de início do step
    orchestratorEvents.emit('step:start', {
      executionId,
      step,
      retryCount: currentRetryCount,
      maxRetries,
    });

    // Buscar sessão existente
    const claudeSessionId = await this.getOrCreateSession(conversation.id, step.id);
    const initialContext = claudeSessionId ? [] : await this.getInitialContext(conversation.id);

    // Acumular conteúdo streaming
    let streamContent = '';
    let streamActions = [];

    const result = await executeClaudeWithSession({
      baseUrl: step.base_url,
      message: input,
      systemPrompt: step.system_prompt,
      systemPromptNoteId: step.system_prompt_note_id,
      contextNoteIds: step.context_note_ids,
      memoryNoteIds: step.memory_note_ids,
      projectPath: conversation.project_path,
      claudeSessionId,
      initialContext,
      processId: executionId,
      onData: (event) => {
        // Acumular conteúdo
        if (event.type === 'content') {
          streamContent += event.content;
        } else if (event.type === 'action') {
          streamActions.push(event.action);
        }

        // Emitir evento de streaming
        orchestratorEvents.emit('step:stream', {
          executionId,
          step,
          event,
          retryCount: currentRetryCount,
        });
      },
    });

    // Salvar sessão se nova
    if (result.sessionId && result.sessionId !== claudeSessionId) {
      await this.saveSession(conversation.id, step.id, result.sessionId);
      orchestratorEvents.emit('session:created', {
        executionId,
        step,
        sessionId: result.sessionId,
      });
    }

    // Processar resultado
    if (result.cancelled) {
      const message = await this.saveMessage(
        conversation.id,
        step.id,
        'system',
        '[Execução cancelada]',
        { cancelled: true, step_name: step.name }
      );

      return {
        success: false,
        cancelled: true,
        message,
      };
    }

    if (result.timedOut) {
      const message = await this.saveMessage(
        conversation.id,
        step.id,
        'assistant',
        result.content || '[Execução excedeu o tempo limite]',
        { timedOut: true, step_name: step.name, actions: result.actions }
      );

      orchestratorEvents.emit('step:timeout', {
        executionId,
        step,
      });

      // Timeout não é necessariamente um erro - pode ter conteúdo parcial
      return {
        success: !!result.content,
        timedOut: true,
        content: result.content,
        message,
        sessionId: result.sessionId,
      };
    }

    if (result.error) {
      const message = await this.saveMessage(
        conversation.id,
        step.id,
        'assistant',
        `[Erro]: ${result.error}`,
        { error: true, step_name: step.name, actions: result.actions }
      );

      orchestratorEvents.emit('step:error', {
        executionId,
        step,
        error: result.error,
      });

      return {
        success: false,
        error: result.error,
        message,
      };
    }

    // Salvar mensagem de sucesso
    const metadata = {
      step_name: step.name,
      step_order: step.step_order,
      actions: result.actions || [],
      sessionId: result.sessionId,
      retryCount: currentRetryCount > 0 ? currentRetryCount : undefined,
    };

    const message = await this.saveMessage(
      conversation.id,
      step.id,
      'assistant',
      result.content,
      metadata
    );

    // Emitir evento de step completo
    orchestratorEvents.emit('step:complete', {
      executionId,
      step,
      message,
      content: result.content,
    });

    return {
      success: true,
      content: result.content,
      message,
      sessionId: result.sessionId,
    };
  }

  /**
   * Executa workflow sequencial completo
   */
  async executeSequential(conversationId, userInput, onEvent) {
    // Verificar se já existe execução ativa
    if (this.hasActiveExecution(conversationId)) {
      throw this.createError('EXECUTION_IN_PROGRESS');
    }

    const executionId = this.generateExecutionId(conversationId);
    const context = await this.getExecutionContext(conversationId);
    const { conversation, steps } = context;

    // Configurar listener de eventos
    const eventHandler = (eventName) => (data) => {
      if (data.executionId === executionId && onEvent) {
        onEvent(eventName, data);
      }
    };

    const events = ['step:start', 'step:stream', 'step:complete', 'step:error', 'session:created', 'message:saved'];
    events.forEach(event => {
      orchestratorEvents.on(event, eventHandler(event));
    });

    // Registrar execução ativa
    const executionState = {
      conversationId,
      executionState: ExecutionState.RUNNING,
      currentStepIndex: 0,
      retryCounts: {},
      metadata: { startedAt: new Date().toISOString() },
    };

    this.activeExecutions.set(executionId, executionState);
    await this.persistExecutionState(executionId, executionState);

    // Salvar mensagem do usuário
    const userMessage = await this.saveMessage(
      conversationId,
      conversation.current_step_id,
      'user',
      userInput
    );

    onEvent?.('user_message', { message: userMessage });

    try {
      let currentInput = userInput;
      let i = 0;

      while (i < steps.length) {
        const step = steps[i];

        // Verificar cancelamento
        if (!this.activeExecutions.has(executionId)) {
          onEvent?.('cancelled', { step: step.name });
          break;
        }

        // Atualizar estado
        executionState.currentStepIndex = i;
        await this.persistExecutionState(executionId, executionState);

        // Executar step
        const result = await this.executeStep(executionId, step, currentInput, {
          conversation,
          retryCounts: executionState.retryCounts,
        });

        if (result.cancelled) {
          break;
        }

        if (!result.success) {
          onEvent?.('step_error', { step: step.name, error: result.error });
          break;
        }

        // Avaliar condições
        const conditionResult = evaluateConditions(result.content, step.conditions);
        const nextStep = resolveNextStep(conditionResult.action, steps, i, step.id);

        if (nextStep.isRetry) {
          const stepRetryKey = step.id;
          const currentRetryCount = (executionState.retryCounts[stepRetryKey] || 0) + 1;
          const maxRetries = conditionResult.rule?.max_retries || step.max_retries || 3;

          if (currentRetryCount >= maxRetries) {
            // Max retries atingido
            onEvent?.('max_retries_reached', {
              step: step.name,
              retries: currentRetryCount,
              maxRetries,
            });

            delete executionState.retryCounts[stepRetryKey];
            i++;
            currentInput = result.content;
          } else {
            // Fazer retry
            executionState.retryCounts[stepRetryKey] = currentRetryCount;

            const retryMessage = formatRetryMessage(
              conditionResult.retryMessage,
              result.content,
              conditionResult.rule
            );

            onEvent?.('condition_retry', {
              step: step.name,
              retry: currentRetryCount,
              maxRetries,
              message: retryMessage,
            });

            currentInput = retryMessage;
            // Não incrementa i - fica no mesmo step
          }
        } else if (nextStep.isFinished) {
          onEvent?.('step_complete', { step: step.name, finished: true });
          delete executionState.retryCounts[step.id];
          break;
        } else {
          // Progressão normal ou jump
          onEvent?.('step_complete', { step: step.name, step_order: i + 1 });
          delete executionState.retryCounts[step.id];

          if (conditionResult.matched && nextStep.nextStepIndex !== i + 1) {
            onEvent?.('condition_jump', {
              from_step: step.name,
              to_step: steps[nextStep.nextStepIndex]?.name,
            });
          }

          i = nextStep.nextStepIndex;
          currentInput = result.content;
        }
      }

      // Marcar como completo
      executionState.executionState = ExecutionState.COMPLETED;
      executionState.metadata.completedAt = new Date().toISOString();
      await this.persistExecutionState(executionId, executionState);

      await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
      onEvent?.('complete', { success: true });

      return { success: true, executionId };

    } catch (error) {
      executionState.executionState = ExecutionState.FAILED;
      executionState.metadata.error = error.message;
      await this.persistExecutionState(executionId, executionState);

      onEvent?.('error', { error: error.message });
      throw error;

    } finally {
      // Limpar listeners
      events.forEach(event => {
        orchestratorEvents.removeListener(event, eventHandler(event));
      });

      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Executa step único (modo step-by-step)
   */
  async executeStepByStep(conversationId, userInput, onEvent) {
    if (this.hasActiveExecution(conversationId)) {
      throw this.createError('EXECUTION_IN_PROGRESS');
    }

    const executionId = this.generateExecutionId(conversationId);
    const context = await this.getExecutionContext(conversationId);
    const { conversation, steps } = context;

    const currentStep = steps.find(s => s.id === conversation.current_step_id);
    if (!currentStep) {
      throw this.createError('STEP_NOT_FOUND');
    }

    // Configurar listener de eventos
    const eventHandler = (eventName) => (data) => {
      if (data.executionId === executionId && onEvent) {
        onEvent(eventName, data);
      }
    };

    const events = ['step:start', 'step:stream', 'step:complete', 'step:error', 'session:created', 'message:saved'];
    events.forEach(event => {
      orchestratorEvents.on(event, eventHandler(event));
    });

    // Registrar execução
    const executionState = {
      conversationId,
      executionState: ExecutionState.RUNNING,
      currentStepIndex: currentStep.step_order - 1,
      retryCounts: {},
      metadata: { startedAt: new Date().toISOString() },
    };

    this.activeExecutions.set(executionId, executionState);

    // Salvar mensagem do usuário
    const userMessage = await this.saveMessage(
      conversationId,
      currentStep.id,
      'user',
      userInput
    );

    onEvent?.('user_message', { message: userMessage });

    try {
      onEvent?.('step_start', { step: currentStep.name, step_order: currentStep.step_order });

      const result = await this.executeStep(executionId, currentStep, userInput, {
        conversation,
        retryCounts: {},
      });

      if (result.cancelled) {
        onEvent?.('cancelled', { step: currentStep.name });
      } else if (!result.success) {
        onEvent?.('step_error', { step: currentStep.name, error: result.error });
      } else {
        onEvent?.('step_complete', { step: currentStep.name });
      }

      await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
      onEvent?.('complete', { success: true });

      return { success: true, executionId, message: result.message };

    } catch (error) {
      onEvent?.('error', { error: error.message });
      throw error;

    } finally {
      events.forEach(event => {
        orchestratorEvents.removeListener(event, eventHandler(event));
      });

      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Cancela execução ativa
   */
  async cancelExecution(conversationId) {
    let cancelled = false;

    for (const [executionId, exec] of this.activeExecutions) {
      if (exec.conversationId === conversationId) {
        cancelClaudeProcess(executionId);

        exec.executionState = ExecutionState.CANCELLED;
        exec.metadata.cancelledAt = new Date().toISOString();
        await this.persistExecutionState(executionId, exec);

        this.activeExecutions.delete(executionId);
        cancelled = true;

        orchestratorEvents.emit('execution:cancelled', {
          executionId,
          conversationId,
        });
      }
    }

    return cancelled;
  }

  /**
   * Obtém status de execução
   */
  getExecutionStatus(conversationId) {
    for (const [executionId, exec] of this.activeExecutions) {
      if (exec.conversationId === conversationId) {
        return {
          executing: true,
          executionId,
          state: exec.executionState,
          currentStepIndex: exec.currentStepIndex,
        };
      }
    }

    return { executing: false };
  }
}

/**
 * Logger de execução para audit trail
 */
export class ExecutionLogger {
  static async log(executionId, conversationId, eventType, stepId, stepName, data = {}) {
    try {
      await query(`
        INSERT INTO execution_logs (execution_id, conversation_id, event_type, step_id, step_name, data)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [executionId, conversationId, eventType, stepId, stepName, JSON.stringify(data)]);
    } catch (error) {
      console.error('[ExecutionLogger] Failed to log event:', error.message);
    }
  }
}

// Hook orchestrator events para logging automático
orchestratorEvents.on('step:start', async (data) => {
  await ExecutionLogger.log(
    data.executionId,
    null, // será resolvido depois
    'step_start',
    data.step?.id,
    data.step?.name,
    { retryCount: data.retryCount, maxRetries: data.maxRetries }
  );
});

orchestratorEvents.on('step:complete', async (data) => {
  await ExecutionLogger.log(
    data.executionId,
    null,
    'step_complete',
    data.step?.id,
    data.step?.name,
    { contentLength: data.content?.length }
  );
});

orchestratorEvents.on('step:error', async (data) => {
  await ExecutionLogger.log(
    data.executionId,
    null,
    'step_error',
    data.step?.id,
    data.step?.name,
    { error: data.error }
  );
});

orchestratorEvents.on('execution:cancelled', async (data) => {
  await ExecutionLogger.log(
    data.executionId,
    data.conversationId,
    'execution_cancelled',
    null,
    null,
    {}
  );
});

// Singleton
export const orchestrator = new TaskOrchestrator();

export default orchestrator;
