import Fastify from 'fastify'
import fastifyCompress from '@fastify/compress'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod'
import { join } from 'path'

import { env } from './lib/env.js'
import { errorHandler } from './http/error-handler.js'
import { auth } from './middlewares/auth.js'
import { registerRateLimit } from './middlewares/rate-limit.js'
import { domainRoutes } from './domains/index.js'
import { startTraceCleanup } from './domains/execution/monitoring/trace-cleanup.js'
import { projectPathLock } from './domains/execution/lock/project-path-lock.js'
import { startExecutionWorker, stopExecutionWorker } from './domains/execution/queue/execution-worker.js'
import { closeExecutionQueue } from './domains/execution/queue/execution-queue.js'
import { closeAllRedis } from './lib/redis.js'
import { recoverStaleExecutions } from './domains/execution/orchestrator/recovery.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
})

// Allow empty body with Content-Type: application/json (fixes DELETE requests from MCP clients)
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try {
    const str = (body as string).trim()
    done(null, str ? JSON.parse(str) : undefined)
  } catch (err) {
    done(err as Error, undefined)
  }
})

// Set validators
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// Set error handler
app.setErrorHandler(errorHandler)

// Register plugins
async function registerPlugins() {
  // Compression (gzip/deflate)
  await app.register(fastifyCompress, { threshold: 1024 })

  // CORS
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  })

  // JWT
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  })

  // Rate limiting
  await registerRateLimit(app)

  // Auth middleware (adds getCurrentUserId to every request)
  await app.register(auth)

  // Multipart (file uploads)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: 10,
    },
  })

  // Static files (uploaded images)
  const uploadsPath = join(process.cwd(), 'uploads')
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: true,
  })

  // Swagger documentation
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Execut API',
        description: 'Claude Orchestrator API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${env.HOST}:${env.PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Workflows', description: 'Workflow management' },
        { name: 'Conversations', description: 'Conversation management' },
        { name: 'Messages', description: 'Message handling and streaming' },
        { name: 'Attachments', description: 'File uploads for messages' },
        { name: 'MCP Servers', description: 'MCP Server management' },
        { name: 'Skills', description: 'Skills management' },
        { name: 'Agents', description: 'Agents management' },
        { name: 'Rules', description: 'Rules management' },
        { name: 'Plugins', description: 'Plugin management' },
        { name: 'Settings', description: 'Application settings' },
        { name: 'Hooks', description: 'Claude Code hooks management' },
        { name: 'Import', description: 'Bulk import from GitHub' },
        { name: 'Git', description: 'GitHub token and git operations' },
      ],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
  })
}

// Register all domain routes
async function registerRoutes() {
  for (const registerDomain of domainRoutes) {
    await app.register(registerDomain)
  }
}

// Start server
async function start() {
  try {
    await registerPlugins()
    await registerRoutes()

    await app.listen({
      host: env.HOST,
      port: env.PORT,
    })

    // SSE connections can last several minutes (Claude executions).
    // Increase Node.js HTTP server timeouts to avoid premature disconnects.
    const httpServer = app.server
    httpServer.keepAliveTimeout = 10 * 60 * 1000 // 10 min
    httpServer.headersTimeout = 10 * 60 * 1000 + 1000 // must be > keepAliveTimeout
    httpServer.requestTimeout = 0 // no limit for SSE streams
    httpServer.timeout = 0 // no socket timeout

    startTraceCleanup()

    // Recover stale executions from previous server crash
    await recoverStaleExecutions()

    // Start BullMQ execution worker
    startExecutionWorker()

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 Execut Backend Server                                   ║
║                                                              ║
║   Server running at: http://${env.HOST}:${env.PORT}              ║
║   Documentation at:  http://${env.HOST}:${env.PORT}/docs         ║
║                                                              ║
║   Environment: ${env.NODE_ENV.padEnd(44)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, shutting down gracefully...`)
    projectPathLock.cleanup()
    try { await stopExecutionWorker() } catch { /* ignore */ }
    try { await closeExecutionQueue() } catch { /* ignore */ }
    try { await app.close() } catch { /* ignore */ }
    try { await closeAllRedis() } catch { /* ignore */ }
    process.exit(0)
  })
})

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err)
})

start()
