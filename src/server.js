import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import http from 'http';
import net from 'net';

import { runMigrations } from './services/database.js';
import workflowRoutes from './routes/workflows.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import smartNotesRoutes from './routes/smart-notes.js';
import transcribeRoutes from './routes/transcribe.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CONFIGURAÇÃO DE ISOLAMENTO
// O servidor principal usa Unix Socket (sem porta TCP)
// Um proxy leve expõe o socket para acesso via browser
// ============================================
const SOCKET_DIR = join(__dirname, '../.runtime');
const SOCKET_PATH = join(SOCKET_DIR, 'execut.sock');
const BROWSER_PORT = process.env.PORT || 3005; // Porta apenas para acesso browser

const fastify = Fastify({
  logger: true,
});

// Registrar CORS
await fastify.register(cors, {
  origin: true,
});

// Registrar multipart para upload de arquivos
await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
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
await fastify.register(transcribeRoutes);

// Rota de health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Criar proxy TCP -> Unix Socket para acesso via browser
function createBrowserProxy(socketPath, port) {
  const proxy = http.createServer((req, res) => {
    const options = {
      socketPath: socketPath,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    req.pipe(proxyReq);
  });

  // Suporte a WebSocket/SSE
  proxy.on('upgrade', (req, socket, head) => {
    const proxySocket = net.connect(socketPath);

    proxySocket.on('connect', () => {
      const requestLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');

      proxySocket.write(requestLine + headers + '\r\n\r\n');
      if (head.length > 0) proxySocket.write(head);

      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
    });

    proxySocket.on('error', () => socket.end());
    socket.on('error', () => proxySocket.end());
  });

  return proxy;
}

// Iniciar servidor
const start = async () => {
  try {
    // Executar migrations
    console.log('Running database migrations...');
    await runMigrations();

    // Garantir que o diretório do socket existe
    if (!existsSync(SOCKET_DIR)) {
      mkdirSync(SOCKET_DIR, { recursive: true });
    }

    // Remover socket antigo se existir
    if (existsSync(SOCKET_PATH)) {
      unlinkSync(SOCKET_PATH);
    }

    // Iniciar servidor principal no Unix Socket (ISOLADO - sem porta TCP)
    await fastify.listen({ path: SOCKET_PATH });
    console.log(`\n🔒 Servidor ISOLADO iniciado no Unix Socket: ${SOCKET_PATH}`);
    console.log('   (Não usa porta TCP - sem conflito com projetos dos clientes)\n');

    // Iniciar proxy para acesso via browser
    const proxy = createBrowserProxy(SOCKET_PATH, BROWSER_PORT);
    proxy.listen(BROWSER_PORT, '127.0.0.1', () => {
      console.log(`🌐 Proxy para browser: http://localhost:${BROWSER_PORT}`);
      console.log('   (Apenas para interface web local)\n');
    });

    // Cleanup ao encerrar
    const cleanup = () => {
      console.log('\nEncerrando...');
      proxy.close();
      fastify.close();
      if (existsSync(SOCKET_PATH)) {
        unlinkSync(SOCKET_PATH);
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
