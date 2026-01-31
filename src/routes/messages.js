import { query } from '../services/database.js';
import { orchestrator, ErrorCatalog } from '../services/orchestrator.js';

export default async function messageRoutes(fastify) {
  // Cancel active execution for a conversation
  fastify.post('/api/conversations/:id/cancel', async (request, reply) => {
    const { id } = request.params;

    const cancelled = await orchestrator.cancelExecution(id);

    if (cancelled) {
      return { success: true, message: 'Execution cancelled' };
    } else {
      return reply.status(ErrorCatalog.EXECUTION_NOT_FOUND.status).send({
        error: ErrorCatalog.EXECUTION_NOT_FOUND.message,
        code: ErrorCatalog.EXECUTION_NOT_FOUND.code,
      });
    }
  });

  // Get execution status
  fastify.get('/api/conversations/:id/status', async (request, reply) => {
    const { id } = request.params;
    const status = orchestrator.getExecutionStatus(id);
    return status;
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

  // Get execution history for a conversation
  fastify.get('/api/conversations/:id/executions', async (request, reply) => {
    const { id } = request.params;
    const { limit = 10 } = request.query;

    const result = await query(`
      SELECT DISTINCT ON (execution_id)
        execution_id,
        state,
        current_step_index,
        metadata,
        created_at,
        updated_at
      FROM execution_state
      WHERE conversation_id = $1
      ORDER BY execution_id, updated_at DESC
      LIMIT $2
    `, [id, limit]);

    return result.rows;
  });

  // Get execution logs for an execution
  fastify.get('/api/executions/:executionId/logs', async (request, reply) => {
    const { executionId } = request.params;
    const { limit = 100 } = request.query;

    const result = await query(`
      SELECT *
      FROM execution_logs
      WHERE execution_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [executionId, limit]);

    return result.rows;
  });

  // Enviar mensagem com streaming (SSE) - REFATORADO PARA USAR ORCHESTRATOR
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
      // Obter tipo de workflow
      const conversationResult = await query(`
        SELECT c.*, w.type as workflow_type
        FROM conversations c
        JOIN workflows w ON c.workflow_id = w.id
        WHERE c.id = $1
      `, [id]);

      if (conversationResult.rows.length === 0) {
        sendSSE('error', { error: ErrorCatalog.CONVERSATION_NOT_FOUND.message });
        reply.raw.end();
        return;
      }

      const conversation = conversationResult.rows[0];

      // Handler de eventos do orchestrator
      const onEvent = (eventName, data) => {
        // Mapear eventos internos para formato SSE esperado pelo frontend
        switch (eventName) {
          case 'user_message':
            sendSSE('user_message', data.message);
            break;

          case 'step:start':
            sendSSE('step_start', {
              step: data.step.name,
              step_order: data.step.step_order,
              total_steps: data.totalSteps,
              retry: data.retryCount > 0 ? data.retryCount : undefined,
              max_retries: data.retryCount > 0 ? data.maxRetries : undefined,
            });
            break;

          case 'step:stream':
            sendSSE('stream', {
              ...data.event,
              step: data.step.name,
              step_order: data.step.step_order,
              retry: data.retryCount > 0 ? data.retryCount : undefined,
            });
            break;

          case 'step:complete':
            sendSSE('step_complete', {
              step: data.step.name,
              step_order: data.step.step_order,
              finished: data.finished,
            });
            break;

          case 'step:error':
            sendSSE('step_error', {
              step: data.step.name,
              error: data.error,
            });
            break;

          case 'session:created':
            sendSSE('session_created', {
              step: data.step.name,
              sessionId: data.sessionId,
            });
            break;

          case 'message:saved':
            sendSSE('message_saved', data.message);
            break;

          case 'condition_retry':
            sendSSE('condition_retry', data);
            break;

          case 'condition_jump':
            sendSSE('condition_jump', data);
            break;

          case 'max_retries_reached':
            sendSSE('max_retries_reached', data);
            break;

          case 'cancelled':
            sendSSE('cancelled', data);
            break;

          case 'complete':
            sendSSE('complete', data);
            break;

          case 'error':
            sendSSE('error', data);
            break;
        }
      };

      // Executar baseado no tipo de workflow
      if (conversation.workflow_type === 'sequential') {
        await orchestrator.executeSequential(id, content, onEvent);
      } else {
        await orchestrator.executeStepByStep(id, content, onEvent);
      }

    } catch (error) {
      // Tratar erros padronizados do orchestrator
      if (error.code && error.status) {
        sendSSE('error', {
          error: error.message,
          code: error.code,
        });
      } else {
        sendSSE('error', { error: error.message });
      }
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

    try {
      const conversationResult = await query(`
        SELECT c.*, w.type as workflow_type
        FROM conversations c
        JOIN workflows w ON c.workflow_id = w.id
        WHERE c.id = $1
      `, [id]);

      if (conversationResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const conversation = conversationResult.rows[0];
      const messages = [];

      // Coletar mensagens dos eventos
      const onEvent = (eventName, data) => {
        if (eventName === 'user_message' || eventName === 'message:saved') {
          messages.push(data.message || data);
        }
      };

      // Executar baseado no tipo
      if (conversation.workflow_type === 'sequential') {
        await orchestrator.executeSequential(id, content, onEvent);
      } else {
        const result = await orchestrator.executeStepByStep(id, content, onEvent);
        if (result.message) {
          messages.push(result.message);
        }
      }

      return { messages };

    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
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

  // Atualizar ações de uma mensagem
  fastify.put('/api/messages/:id/actions', async (request, reply) => {
    const { id } = request.params;
    const { actions } = request.body;

    if (!Array.isArray(actions)) {
      return reply.status(400).send({ error: 'actions must be an array' });
    }

    const current = await query('SELECT metadata FROM messages WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    const currentMetadata = current.rows[0].metadata || {};
    const newMetadata = {
      ...currentMetadata,
      actions: actions,
    };

    const result = await query(
      'UPDATE messages SET metadata = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(newMetadata), id]
    );

    console.log(`[Messages] Ações atualizadas para mensagem ${id}: ${actions.length} ações`);

    return result.rows[0];
  });
}
