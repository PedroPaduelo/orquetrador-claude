import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:34ddda50fddea248f2b5@cloud.nommand.com:54363/agente-biulder?sslmode=disable';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function getClient() {
  return pool.connect();
}

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabela workflows
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL CHECK (type IN ('sequential', 'step_by_step')),
        project_path TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add project_path column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'project_path') THEN
          ALTER TABLE workflows ADD COLUMN project_path TEXT;
        END IF;
      END $$;
    `);

    // Tabela workflow_steps
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        base_url TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        system_prompt TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add new columns for Smart Notes integration and conditions
    await client.query(`
      DO $$
      BEGIN
        -- Smart Notes integration columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'system_prompt_note_id') THEN
          ALTER TABLE workflow_steps ADD COLUMN system_prompt_note_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'context_note_ids') THEN
          ALTER TABLE workflow_steps ADD COLUMN context_note_ids TEXT[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'memory_note_ids') THEN
          ALTER TABLE workflow_steps ADD COLUMN memory_note_ids TEXT[];
        END IF;

        -- Conditions columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'conditions') THEN
          ALTER TABLE workflow_steps ADD COLUMN conditions JSONB DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'max_retries') THEN
          ALTER TABLE workflow_steps ADD COLUMN max_retries INTEGER DEFAULT 0;
        END IF;

        -- Multi-backend support
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'backend') THEN
          ALTER TABLE workflow_steps ADD COLUMN backend TEXT DEFAULT 'claude';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_steps' AND column_name = 'model') THEN
          ALTER TABLE workflow_steps ADD COLUMN model TEXT;
        END IF;
      END $$;
    `);

    // Tabela conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        title VARCHAR(255),
        current_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        selected_for_context BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela conversation_sessions - uma sessão Claude por step
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        step_id UUID REFERENCES workflow_steps(id) ON DELETE CASCADE,
        claude_session_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, step_id)
      );
    `);

    // Índices para melhor performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_sessions_lookup ON conversation_sessions(conversation_id, step_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_workflow_id ON conversations(workflow_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);

    await client.query('COMMIT');
    console.log('Migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default { query, getClient, runMigrations };
