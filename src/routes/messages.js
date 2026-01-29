import { query } from '../services/database.js';
import { executeClaudeWithSession, cancelClaudeProcess } from '../services/claude.js';
import { evaluateConditions, resolveNextStep, formatRetryMessage } from '../services/conditions.js';

// Track active executions per conversation
const activeExecutions = new Map();

// Track retry counts per conversation per step
const retryCounters = new Map();

export default async function messageRoutes(fastify) {
  // Cancel active execution for a conversation
  fastify.post('/api/conversations/:id/cancel', async (request, reply) => {
    const { id } = request.params;

    const processId = activeExecutions.get(id);
    if (!processId) {
      return reply.status(404).send({ error: 'No active execution for this conversation' });
    }

    const cancelled = cancelClaudeProcess(processId);
    activeExecutions.delete(id);

    if (cancelled) {
      return { success: true, message: 'Execution cancelled' };
    } else {
      return reply.status(404).send({ error: 'Process not found or already finished' });
    }
  });

  // Get execution status
  fastify.get('/api/conversations/:id/status', async (request, reply) => {
    const { id } = request.params;
    const processId = activeExecutions.get(id);
    return {
      executing: !!processId,
      processId: processId || null,
    };
  });

  // Get messages for a specific step (for context selection modal)
  fastify.get('/api/conversations/:id/steps/:stepId/messages', async (request, reply) => {
    const { id, stepId } = request.params;

    const result = await query(`
      SELECT m.id, m.role, m.content, m.created_at,
             ws.name as step_name
      FROM messages m
      LEFT JOIN workflow_steps ws ON m.step_id = ws.id
      WHERE m.conversation_id = $1 AND m.step_id = $2
      ORDER BY m.created_at ASC
    `, [id, stepId]);

    return result.rows;
  });

  // Get session for a step
  async function getOrCreateSession(conversationId, stepId) {
    const existing = await query(
      'SELECT claude_session_id FROM conversation_sessions WHERE conversation_id = $1 AND step_id = $2',
      [conversationId, stepId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].claude_session_id;
    }

    return null; // Will be created on first message
  }

  // Save session for a step
  async function saveSession(conversationId, stepId, claudeSessionId) {
    await query(`
      INSERT INTO conversation_sessions (conversation_id, step_id, claude_session_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (conversation_id, step_id)
      DO UPDATE SET claude_session_id = $3
    `, [conversationId, stepId, claudeSessionId]);
  }

  // Get initial context for a new step (selected messages from previous step)
  async function getInitialContext(conversationId) {
    const result = await query(
      'SELECT content, role FROM messages WHERE conversation_id = $1 AND selected_for_context = true ORDER BY created_at',
      [conversationId]
    );
    return result.rows.map(m => `${m.role}: ${m.content}`);
  }

  // Enviar mensagem com streaming (SSE)
  fastify.post('/api/conversations/:id/messages/stream', async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body;

    if (!content || !content.trim()) {
      return reply.status(400).send({ error: 'content is required' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendSSE = (event, data) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Obter conversa com workflow
      const conversationResult = await query(`
        SELECT c.*, w.type as workflow_type, w.project_path
        FROM conversations c
        JOIN workflows w ON c.workflow_id = w.id
        WHERE c.id = $1
      `, [id]);

      if (conversationResult.rows.length === 0) {
        sendSSE('error', { error: 'Conversation not found' });
        reply.raw.end();
        return;
      }

      const conversation = conversationResult.rows[0];

      // Obter steps do workflow
      const stepsResult = await query(
        'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
        [conversation.workflow_id]
      );

      if (stepsResult.rows.length === 0) {
        sendSSE('error', { error: 'Workflow has no steps' });
        reply.raw.end();
        return;
      }

      const steps = stepsResult.rows;

      // Salvar mensagem do usuário
      const userMessage = await query(
        'INSERT INTO messages (conversation_id, step_id, role, content) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, conversation.current_step_id, 'user', content]
      );

      sendSSE('user_message', userMessage.rows[0]);

      // Generate process ID
      const processId = `exec_${id}_${Date.now()}`;
      activeExecutions.set(id, processId);

      try {
        if (conversation.workflow_type === 'sequential') {
          // Modo sequencial: passa por todos os steps com suporte a condicionais
          let currentInput = content;
          let i = 0;

          // Initialize retry counter for this conversation
          const retryKey = `${id}`;
          if (!retryCounters.has(retryKey)) {
            retryCounters.set(retryKey, new Map());
          }
          const stepRetries = retryCounters.get(retryKey);

          while (i < steps.length) {
            const step = steps[i];

            if (!activeExecutions.has(id)) {
              sendSSE('cancelled', { step: step.name });
              break;
            }

            // Get retry count for this step
            const stepRetryKey = step.id;
            const currentRetryCount = stepRetries.get(stepRetryKey) || 0;
            const maxRetries = step.max_retries || step.conditions?.max_retries || 3;
            const isRetry = currentRetryCount > 0;

            sendSSE('step_start', {
              step: step.name,
              step_order: i + 1,
              total_steps: steps.length,
              retry: isRetry ? currentRetryCount : undefined,
              max_retries: isRetry ? maxRetries : undefined,
            });

            // Buscar sessão existente para este step
            const claudeSessionId = await getOrCreateSession(id, step.id);

            // Se primeira mensagem no step, buscar contexto inicial
            const initialContext = claudeSessionId ? [] : await getInitialContext(id);

            const result = await executeClaudeWithSession({
              baseUrl: step.base_url,
              message: currentInput,
              systemPrompt: step.system_prompt,
              systemPromptNoteId: step.system_prompt_note_id,
              contextNoteIds: step.context_note_ids,
              memoryNoteIds: step.memory_note_ids,
              projectPath: conversation.project_path,
              claudeSessionId,
              initialContext,
              processId,
              onData: (event) => {
                sendSSE('stream', { ...event, step: step.name, step_order: i + 1, retry: isRetry ? currentRetryCount : undefined });
              },
            });

            // Salvar sessão se nova
            if (result.sessionId && result.sessionId !== claudeSessionId) {
              await saveSession(id, step.id, result.sessionId);
              sendSSE('session_created', { step: step.name, sessionId: result.sessionId });
            }

            if (result.cancelled) {
              const cancelledMsg = await query(
                'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, step.id, 'system', '[Execução cancelada]', JSON.stringify({ cancelled: true, step_name: step.name })]
              );
              sendSSE('message_saved', cancelledMsg.rows[0]);
              break;
            }

            if (result.error) {
              const errorMsg = await query(
                'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, step.id, 'assistant', `[Erro]: ${result.error}`, JSON.stringify({ error: true, step_name: step.name, actions: result.actions })]
              );
              sendSSE('message_saved', errorMsg.rows[0]);
              sendSSE('step_error', { step: step.name, error: result.error });
              break;
            }

            // Save assistant message
            const assistantMsg = await query(
              'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [id, step.id, 'assistant', result.content, JSON.stringify({
                step_name: step.name,
                step_order: i + 1,
                actions: result.actions,
                sessionId: result.sessionId,
                retry: isRetry ? currentRetryCount : undefined,
              })]
            );
            sendSSE('message_saved', assistantMsg.rows[0]);

            // Evaluate conditions to determine next step
            const conditionResult = evaluateConditions(result.content, step.conditions);
            const nextStep = resolveNextStep(conditionResult.action, steps, i, step.id);

            if (nextStep.isRetry) {
              // Handle retry
              const newRetryCount = currentRetryCount + 1;
              const maxRetriesForStep = conditionResult.rule?.max_retries || maxRetries;

              if (newRetryCount >= maxRetriesForStep) {
                // Max retries reached, move to next step or fail
                sendSSE('max_retries_reached', {
                  step: step.name,
                  retries: newRetryCount,
                  max_retries: maxRetriesForStep,
                });
                stepRetries.delete(stepRetryKey);

                // Move to next step after max retries
                i++;
                currentInput = result.content;
              } else {
                // Retry the step
                stepRetries.set(stepRetryKey, newRetryCount);

                // Format retry message
                const retryMessage = formatRetryMessage(
                  conditionResult.retryMessage,
                  result.content,
                  conditionResult.rule
                );

                sendSSE('condition_retry', {
                  step: step.name,
                  retry: newRetryCount,
                  max_retries: maxRetriesForStep,
                  condition_matched: conditionResult.rule?.match,
                  message: retryMessage,
                });

                // Update input for retry
                currentInput = retryMessage;

                // Don't increment i - stay on same step
              }
            } else if (nextStep.isFinished) {
              // Workflow finished
              sendSSE('step_complete', { step: step.name, step_order: i + 1, finished: true });
              stepRetries.delete(stepRetryKey);
              break;
            } else {
              // Normal progression or jump to specific step
              sendSSE('step_complete', { step: step.name, step_order: i + 1 });
              stepRetries.delete(stepRetryKey);

              if (conditionResult.matched && nextStep.nextStepIndex !== i + 1) {
                // Condition matched, jumping to specific step
                sendSSE('condition_jump', {
                  from_step: step.name,
                  to_step: steps[nextStep.nextStepIndex]?.name,
                  condition_matched: conditionResult.rule?.match,
                });
              }

              i = nextStep.nextStepIndex;
              currentInput = result.content;
            }
          }

          // Clean up retry counters for this conversation
          retryCounters.delete(retryKey);
        } else {
          // Modo step-by-step: envia apenas para step atual
          const currentStep = steps.find(s => s.id === conversation.current_step_id);

          if (!currentStep) {
            sendSSE('error', { error: 'Current step not found' });
            reply.raw.end();
            return;
          }

          sendSSE('step_start', { step: currentStep.name, step_order: currentStep.step_order });

          // Buscar sessão existente para este step
          const claudeSessionId = await getOrCreateSession(id, currentStep.id);

          // Se primeira mensagem no step, buscar contexto inicial (mensagens selecionadas)
          const initialContext = claudeSessionId ? [] : await getInitialContext(id);

          const result = await executeClaudeWithSession({
            baseUrl: currentStep.base_url,
            message: content,
            systemPrompt: currentStep.system_prompt,
            systemPromptNoteId: currentStep.system_prompt_note_id,
            contextNoteIds: currentStep.context_note_ids,
            memoryNoteIds: currentStep.memory_note_ids,
            projectPath: conversation.project_path,
            claudeSessionId,
            initialContext,
            processId,
            onData: (event) => {
              sendSSE('stream', { ...event, step: currentStep.name });
            },
          });

          // Salvar sessão se nova
          if (result.sessionId && result.sessionId !== claudeSessionId) {
            await saveSession(id, currentStep.id, result.sessionId);
            sendSSE('session_created', { step: currentStep.name, sessionId: result.sessionId });
          }

          if (result.cancelled) {
            const cancelledMsg = await query(
              'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [id, currentStep.id, 'system', '[Execução cancelada]', JSON.stringify({ cancelled: true, step_name: currentStep.name })]
            );
            sendSSE('message_saved', cancelledMsg.rows[0]);
          } else if (result.error) {
            const errorMsg = await query(
              'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [id, currentStep.id, 'assistant', `[Erro]: ${result.error}`, JSON.stringify({ error: true, step_name: currentStep.name, actions: result.actions })]
            );
            sendSSE('message_saved', errorMsg.rows[0]);
          } else {
            const assistantMsg = await query(
              'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [id, currentStep.id, 'assistant', result.content, JSON.stringify({ step_name: currentStep.name, actions: result.actions, sessionId: result.sessionId })]
            );
            sendSSE('message_saved', assistantMsg.rows[0]);
          }

          sendSSE('step_complete', { step: currentStep.name });
        }

        await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);
        sendSSE('complete', { success: true });

      } finally {
        activeExecutions.delete(id);
      }

    } catch (error) {
      sendSSE('error', { error: error.message });
    }

    reply.raw.end();
  });

  // Enviar mensagem (não-streaming) - mantido para compatibilidade
  fastify.post('/api/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body;

    if (!content || !content.trim()) {
      return reply.status(400).send({ error: 'content is required' });
    }

    // Redirecionar para streaming internamente
    const conversationResult = await query(`
      SELECT c.*, w.type as workflow_type, w.project_path
      FROM conversations c
      JOIN workflows w ON c.workflow_id = w.id
      WHERE c.id = $1
    `, [id]);

    if (conversationResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    const conversation = conversationResult.rows[0];

    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [conversation.workflow_id]
    );

    if (stepsResult.rows.length === 0) {
      return reply.status(400).send({ error: 'Workflow has no steps' });
    }

    const steps = stepsResult.rows;

    // Salvar mensagem do usuário
    const userMessage = await query(
      'INSERT INTO messages (conversation_id, step_id, role, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, conversation.current_step_id, 'user', content]
    );

    const messages = [userMessage.rows[0]];

    const processId = `exec_${id}_${Date.now()}`;
    activeExecutions.set(id, processId);

    try {
      const currentStep = steps.find(s => s.id === conversation.current_step_id);

      if (!currentStep) {
        activeExecutions.delete(id);
        return reply.status(400).send({ error: 'Current step not found' });
      }

      const claudeSessionId = await getOrCreateSession(id, currentStep.id);
      const initialContext = claudeSessionId ? [] : await getInitialContext(id);

      const result = await executeClaudeWithSession({
        baseUrl: currentStep.base_url,
        message: content,
        systemPrompt: currentStep.system_prompt,
        systemPromptNoteId: currentStep.system_prompt_note_id,
        contextNoteIds: currentStep.context_note_ids,
        memoryNoteIds: currentStep.memory_note_ids,
        projectPath: conversation.project_path,
        claudeSessionId,
        initialContext,
        processId,
      });

      if (result.sessionId && result.sessionId !== claudeSessionId) {
        await saveSession(id, currentStep.id, result.sessionId);
      }

      if (result.cancelled) {
        const cancelledMessage = await query(
          'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [id, currentStep.id, 'system', '[Execução cancelada pelo usuário]', JSON.stringify({ cancelled: true, step_name: currentStep.name })]
        );
        messages.push(cancelledMessage.rows[0]);
      } else if (result.error) {
        const errorMessage = await query(
          'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [id, currentStep.id, 'assistant', `[Erro]: ${result.error}`, JSON.stringify({ error: true, step_name: currentStep.name })]
        );
        messages.push(errorMessage.rows[0]);
      } else {
        const assistantMessage = await query(
          'INSERT INTO messages (conversation_id, step_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [id, currentStep.id, 'assistant', result.content, JSON.stringify({ step_name: currentStep.name, step_order: currentStep.step_order, sessionId: result.sessionId })]
        );
        messages.push(assistantMessage.rows[0]);
      }
    } finally {
      activeExecutions.delete(id);
    }

    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);

    return { messages };
  });

  // Marcar/desmarcar mensagem para contexto
  fastify.put('/api/messages/:id/select', async (request, reply) => {
    const { id } = request.params;
    const { selected } = request.body;

    const result = await query(
      'UPDATE messages SET selected_for_context = $1 WHERE id = $2 RETURNING *',
      [selected === true, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    return result.rows[0];
  });

  // Selecionar múltiplas mensagens para contexto de uma vez
  fastify.post('/api/conversations/:id/select-context', async (request, reply) => {
    const { id } = request.params;
    const { messageIds } = request.body;

    if (!Array.isArray(messageIds)) {
      return reply.status(400).send({ error: 'messageIds must be an array' });
    }

    // Desmarcar todas as mensagens da conversa primeiro
    await query(
      'UPDATE messages SET selected_for_context = false WHERE conversation_id = $1',
      [id]
    );

    // Marcar apenas as selecionadas
    if (messageIds.length > 0) {
      await query(
        'UPDATE messages SET selected_for_context = true WHERE id = ANY($1) AND conversation_id = $2',
        [messageIds, id]
      );
    }

    return { success: true, selectedCount: messageIds.length };
  });

  // Obter mensagens de uma conversa
  fastify.get('/api/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params;

    const result = await query(`
      SELECT m.*,
        ws.name as step_name,
        ws.step_order
      FROM messages m
      LEFT JOIN workflow_steps ws ON m.step_id = ws.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [id]);

    return result.rows;
  });

  // Deletar mensagem
  fastify.delete('/api/messages/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await query('DELETE FROM messages WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    return { success: true, deleted: result.rows[0] };
  });
}
