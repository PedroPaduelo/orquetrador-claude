import { query } from '../services/database.js';

export default async function conversationRoutes(fastify) {
  // Listar conversas
  fastify.get('/api/conversations', async (request, reply) => {
    const { workflow_id } = request.query;

    let sql = `
      SELECT c.*,
        w.name as workflow_name,
        w.type as workflow_type,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      LEFT JOIN workflows w ON c.workflow_id = w.id
    `;
    const params = [];

    if (workflow_id) {
      sql += ' WHERE c.workflow_id = $1';
      params.push(workflow_id);
    }

    sql += ' ORDER BY c.updated_at DESC';

    const result = await query(sql, params);
    return result.rows;
  });

  // Criar conversa
  fastify.post('/api/conversations', async (request, reply) => {
    const { workflow_id, title } = request.body;

    if (!workflow_id) {
      return reply.status(400).send({ error: 'workflow_id is required' });
    }

    // Verificar se workflow existe e obter primeiro step
    const workflow = await query('SELECT * FROM workflows WHERE id = $1', [workflow_id]);
    if (workflow.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const firstStep = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order LIMIT 1',
      [workflow_id]
    );

    const currentStepId = firstStep.rows.length > 0 ? firstStep.rows[0].id : null;

    // Gerar título se não fornecido
    const conversationTitle = title || `Conversa ${new Date().toLocaleDateString('pt-BR')}`;

    const result = await query(
      'INSERT INTO conversations (workflow_id, title, current_step_id) VALUES ($1, $2, $3) RETURNING *',
      [workflow_id, conversationTitle, currentStepId]
    );

    return reply.status(201).send(result.rows[0]);
  });

  // Obter conversa com mensagens
  fastify.get('/api/conversations/:id', async (request, reply) => {
    const { id } = request.params;

    const conversationResult = await query(`
      SELECT c.*,
        w.name as workflow_name,
        w.type as workflow_type
      FROM conversations c
      LEFT JOIN workflows w ON c.workflow_id = w.id
      WHERE c.id = $1
    `, [id]);

    if (conversationResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    const conversation = conversationResult.rows[0];

    // Obter mensagens
    const messagesResult = await query(`
      SELECT m.*,
        ws.name as step_name,
        ws.step_order
      FROM messages m
      LEFT JOIN workflow_steps ws ON m.step_id = ws.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [id]);

    // Obter steps do workflow
    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [conversation.workflow_id]
    );

    // Obter step atual
    let currentStep = null;
    if (conversation.current_step_id) {
      const currentStepResult = await query(
        'SELECT * FROM workflow_steps WHERE id = $1',
        [conversation.current_step_id]
      );
      if (currentStepResult.rows.length > 0) {
        currentStep = currentStepResult.rows[0];
      }
    }

    return {
      ...conversation,
      messages: messagesResult.rows,
      steps: stepsResult.rows,
      current_step: currentStep,
    };
  });

  // Atualizar conversa (título)
  fastify.put('/api/conversations/:id', async (request, reply) => {
    const { id } = request.params;
    const { title } = request.body;

    const result = await query(
      'UPDATE conversations SET title = COALESCE($1, title), updated_at = NOW() WHERE id = $2 RETURNING *',
      [title, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return result.rows[0];
  });

  // Deletar conversa
  fastify.delete('/api/conversations/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await query('DELETE FROM conversations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return { success: true, deleted: result.rows[0] };
  });

  // Avançar para próximo step (modo step-by-step)
  fastify.post('/api/conversations/:id/advance', async (request, reply) => {
    const { id } = request.params;

    // Obter conversa
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

    if (conversation.workflow_type !== 'step_by_step') {
      return reply.status(400).send({ error: 'Only step_by_step workflows can advance steps' });
    }

    // Obter step atual
    const currentStepResult = await query(
      'SELECT * FROM workflow_steps WHERE id = $1',
      [conversation.current_step_id]
    );

    if (currentStepResult.rows.length === 0) {
      return reply.status(400).send({ error: 'Current step not found' });
    }

    const currentStep = currentStepResult.rows[0];

    // Obter próximo step
    const nextStepResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 AND step_order > $2 ORDER BY step_order LIMIT 1',
      [conversation.workflow_id, currentStep.step_order]
    );

    if (nextStepResult.rows.length === 0) {
      return reply.status(400).send({ error: 'Already at the last step' });
    }

    const nextStep = nextStepResult.rows[0];

    // Atualizar conversa
    await query(
      'UPDATE conversations SET current_step_id = $1, updated_at = NOW() WHERE id = $2',
      [nextStep.id, id]
    );

    return {
      success: true,
      previous_step: currentStep,
      current_step: nextStep,
    };
  });

  // Voltar para step anterior (modo step-by-step)
  fastify.post('/api/conversations/:id/go-back', async (request, reply) => {
    const { id } = request.params;

    // Obter conversa
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

    if (conversation.workflow_type !== 'step_by_step') {
      return reply.status(400).send({ error: 'Only step_by_step workflows can change steps' });
    }

    // Obter step atual
    const currentStepResult = await query(
      'SELECT * FROM workflow_steps WHERE id = $1',
      [conversation.current_step_id]
    );

    if (currentStepResult.rows.length === 0) {
      return reply.status(400).send({ error: 'Current step not found' });
    }

    const currentStep = currentStepResult.rows[0];

    // Obter step anterior
    const prevStepResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 AND step_order < $2 ORDER BY step_order DESC LIMIT 1',
      [conversation.workflow_id, currentStep.step_order]
    );

    if (prevStepResult.rows.length === 0) {
      return reply.status(400).send({ error: 'Already at the first step' });
    }

    const prevStep = prevStepResult.rows[0];

    // Atualizar conversa
    await query(
      'UPDATE conversations SET current_step_id = $1, updated_at = NOW() WHERE id = $2',
      [prevStep.id, id]
    );

    return {
      success: true,
      previous_step: currentStep,
      current_step: prevStep,
    };
  });
}
