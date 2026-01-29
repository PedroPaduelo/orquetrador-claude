import { query } from '../services/database.js';

export default async function workflowRoutes(fastify) {
  // Listar todos os workflows
  fastify.get('/api/workflows', async (request, reply) => {
    const result = await query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) as step_count
      FROM workflows w
      ORDER BY w.created_at DESC
    `);
    return result.rows;
  });

  // Criar workflow
  fastify.post('/api/workflows', async (request, reply) => {
    const { name, description, type, steps, project_path } = request.body;

    if (!name || !type) {
      return reply.status(400).send({ error: 'name and type are required' });
    }

    if (!['sequential', 'step_by_step'].includes(type)) {
      return reply.status(400).send({ error: 'type must be sequential or step_by_step' });
    }

    // Criar workflow
    const workflowResult = await query(
      'INSERT INTO workflows (name, description, type, project_path) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || null, type, project_path || null]
    );
    const workflow = workflowResult.rows[0];

    // Criar steps se fornecidos
    if (steps && Array.isArray(steps) && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await query(
          `INSERT INTO workflow_steps (
            workflow_id, name, base_url, step_order, system_prompt,
            system_prompt_note_id, context_note_ids, memory_note_ids,
            conditions, max_retries, backend, model
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            workflow.id,
            step.name,
            step.base_url,
            i + 1,
            step.system_prompt || null,
            step.system_prompt_note_id || null,
            step.context_note_ids || null,
            step.memory_note_ids || null,
            step.conditions ? JSON.stringify(step.conditions) : '{}',
            step.max_retries || 0,
            step.backend || 'claude',
            step.model || null,
          ]
        );
      }
    }

    // Retornar workflow com steps
    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [workflow.id]
    );

    return reply.status(201).send({
      ...workflow,
      steps: stepsResult.rows,
    });
  });

  // Obter workflow com steps
  fastify.get('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;

    const workflowResult = await query('SELECT * FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [id]
    );

    return {
      ...workflowResult.rows[0],
      steps: stepsResult.rows,
    };
  });

  // Atualizar workflow
  fastify.put('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, type, steps, project_path } = request.body;

    // Verificar se existe
    const existing = await query('SELECT * FROM workflows WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    // Atualizar workflow
    const updateResult = await query(
      `UPDATE workflows
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           project_path = COALESCE($4, project_path),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, description, type, project_path, id]
    );

    // Atualizar steps se fornecidos
    if (steps && Array.isArray(steps)) {
      // Remover steps existentes
      await query('DELETE FROM workflow_steps WHERE workflow_id = $1', [id]);

      // Inserir novos steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await query(
          `INSERT INTO workflow_steps (
            workflow_id, name, base_url, step_order, system_prompt,
            system_prompt_note_id, context_note_ids, memory_note_ids,
            conditions, max_retries, backend, model
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            id,
            step.name,
            step.base_url,
            i + 1,
            step.system_prompt || null,
            step.system_prompt_note_id || null,
            step.context_note_ids || null,
            step.memory_note_ids || null,
            step.conditions ? JSON.stringify(step.conditions) : '{}',
            step.max_retries || 0,
            step.backend || 'claude',
            step.model || null,
          ]
        );
      }
    }

    // Retornar workflow com steps
    const stepsResult = await query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order',
      [id]
    );

    return {
      ...updateResult.rows[0],
      steps: stepsResult.rows,
    };
  });

  // Deletar workflow
  fastify.delete('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await query('DELETE FROM workflows WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return { success: true, deleted: result.rows[0] };
  });

  // Adicionar step a um workflow
  fastify.post('/api/workflows/:id/steps', async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      base_url,
      system_prompt,
      system_prompt_note_id,
      context_note_ids,
      memory_note_ids,
      conditions,
      max_retries,
      backend,
      model,
    } = request.body;

    if (!name || !base_url) {
      return reply.status(400).send({ error: 'name and base_url are required' });
    }

    // Verificar se workflow existe
    const workflow = await query('SELECT * FROM workflows WHERE id = $1', [id]);
    if (workflow.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    // Obter próximo step_order
    const maxOrder = await query(
      'SELECT COALESCE(MAX(step_order), 0) as max_order FROM workflow_steps WHERE workflow_id = $1',
      [id]
    );

    const stepOrder = maxOrder.rows[0].max_order + 1;

    const result = await query(
      `INSERT INTO workflow_steps (
        workflow_id, name, base_url, step_order, system_prompt,
        system_prompt_note_id, context_note_ids, memory_note_ids,
        conditions, max_retries, backend, model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        id,
        name,
        base_url,
        stepOrder,
        system_prompt || null,
        system_prompt_note_id || null,
        context_note_ids || null,
        memory_note_ids || null,
        conditions ? JSON.stringify(conditions) : '{}',
        max_retries || 0,
        backend || 'claude',
        model || null,
      ]
    );

    return reply.status(201).send(result.rows[0]);
  });

  // Deletar step de um workflow
  fastify.delete('/api/workflows/:workflowId/steps/:stepId', async (request, reply) => {
    const { workflowId, stepId } = request.params;

    const result = await query(
      'DELETE FROM workflow_steps WHERE id = $1 AND workflow_id = $2 RETURNING *',
      [stepId, workflowId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Step not found' });
    }

    // Reordenar steps restantes
    await query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY step_order) as new_order
        FROM workflow_steps
        WHERE workflow_id = $1
      )
      UPDATE workflow_steps
      SET step_order = ordered.new_order
      FROM ordered
      WHERE workflow_steps.id = ordered.id
    `, [workflowId]);

    return { success: true, deleted: result.rows[0] };
  });
}
