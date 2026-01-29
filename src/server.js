import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { runMigrations } from './services/database.js';
import workflowRoutes from './routes/workflows.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import smartNotesRoutes from './routes/smart-notes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
});

// Registrar CORS
await fastify.register(cors, {
  origin: true,
});

// Servir arquivos estáticos
await fastify.register(fastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/',
});

// Registrar rotas
await fastify.register(workflowRoutes);
await fastify.register(conversationRoutes);
await fastify.register(messageRoutes);
await fastify.register(smartNotesRoutes);

// Rota de health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Iniciar servidor
const start = async () => {
  try {
    // Executar migrations
    console.log('Running database migrations...');
    await runMigrations();

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
