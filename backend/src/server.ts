import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod'

import { env } from './lib/env.js'
import { errorHandler } from './http/error-handler.js'

// Workflow routes
import {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from './http/routes/workflows/index.js'

// Conversation routes
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  cancelExecution,
  getConversationStatus,
  advanceStep,
} from './http/routes/conversations/index.js'

// Message routes
import {
  sendMessageStream,
  listMessages,
  toggleMessageContext,
  updateMessageActions,
  deleteMessage,
} from './http/routes/messages/index.js'

// Smart Notes routes
import {
  getSmartNotesStatus,
  listSmartNotesFolders,
  listSmartNotes,
  searchSmartNotes,
  getSmartNote,
  previewSmartNotesContext,
} from './http/routes/smart-notes/index.js'

// Transcribe routes
import { transcribeAudio } from './http/routes/transcribe/index.js'

// Health routes
import { healthCheck } from './http/routes/health/index.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
})

// Set validators
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// Set error handler
app.setErrorHandler(errorHandler)

// Register plugins
async function registerPlugins() {
  // CORS
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  })

  // Multipart (file uploads)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: 1,
    },
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
        { name: 'Smart Notes', description: 'Smart Notes integration' },
        { name: 'Transcription', description: 'Audio transcription' },
      ],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
  })
}

// Register routes
async function registerRoutes() {
  // Health
  await app.register(healthCheck)

  // Workflows
  await app.register(createWorkflow)
  await app.register(listWorkflows)
  await app.register(getWorkflow)
  await app.register(updateWorkflow)
  await app.register(deleteWorkflow)

  // Conversations
  await app.register(createConversation)
  await app.register(listConversations)
  await app.register(getConversation)
  await app.register(deleteConversation)
  await app.register(cancelExecution)
  await app.register(getConversationStatus)
  await app.register(advanceStep)

  // Messages
  await app.register(sendMessageStream)
  await app.register(listMessages)
  await app.register(toggleMessageContext)
  await app.register(updateMessageActions)
  await app.register(deleteMessage)

  // Smart Notes
  await app.register(getSmartNotesStatus)
  await app.register(listSmartNotesFolders)
  await app.register(listSmartNotes)
  await app.register(searchSmartNotes)
  await app.register(getSmartNote)
  await app.register(previewSmartNotesContext)

  // Transcription
  await app.register(transcribeAudio)
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
    await app.close()
    process.exit(0)
  })
})

start()
