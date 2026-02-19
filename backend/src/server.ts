import Fastify from 'fastify'
import fastifyCompress from '@fastify/compress'
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
  duplicateWorkflow,
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
  goBackStep,
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
  createSmartNotesFolder,
  updateSmartNotesFolder,
  deleteSmartNotesFolder,
  listSmartNotes,
  searchSmartNotes,
  getSmartNote,
  createSmartNote,
  updateSmartNote,
  deleteSmartNote,
  smartNoteActions,
  previewSmartNotesContext,
} from './http/routes/smart-notes/index.js'

// MCP Servers routes
import {
  listMcpServers,
  createMcpServer,
  getMcpServer,
  updateMcpServer,
  deleteMcpServer,
  testMcpServer,
  toggleMcpServer,
  quickInstallMcpServer,
} from './http/routes/mcp-servers/index.js'

// Skills routes
import {
  listSkills,
  createSkill,
  getSkill,
  updateSkill,
  deleteSkill,
  toggleSkill,
  importSkill,
} from './http/routes/skills/index.js'

// Agents routes
import {
  listAgents,
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  toggleAgent,
  importAgent,
} from './http/routes/agents/index.js'

// Rules routes
import {
  listRules,
  createRule,
  getRule,
  updateRule,
  deleteRule,
  toggleRule,
  importRule,
} from './http/routes/rules/index.js'

// Plugins routes
import {
  listPlugins,
  getPlugin,
  installPlugin,
  updatePlugin,
  deletePlugin,
  togglePlugin,
  importPluginUrl,
  resyncPlugin,
} from './http/routes/plugins/index.js'

// Settings routes
import {
  getSettings,
  updateSettings,
} from './http/routes/settings/index.js'

// Import repo (bulk import)
import { importRepo } from './http/routes/import-repo.js'

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
  // Compression (gzip/deflate)
  await app.register(fastifyCompress, { threshold: 1024 })

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
        { name: 'MCP Servers', description: 'MCP Server management' },
        { name: 'Skills', description: 'Skills management' },
        { name: 'Agents', description: 'Agents management' },
        { name: 'Rules', description: 'Rules management' },
        { name: 'Plugins', description: 'Plugin management' },
        { name: 'Settings', description: 'Application settings' },
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
  await app.register(duplicateWorkflow)

  // Conversations
  await app.register(createConversation)
  await app.register(listConversations)
  await app.register(getConversation)
  await app.register(deleteConversation)
  await app.register(cancelExecution)
  await app.register(getConversationStatus)
  await app.register(advanceStep)
  await app.register(goBackStep)

  // Messages
  await app.register(sendMessageStream)
  await app.register(listMessages)
  await app.register(toggleMessageContext)
  await app.register(updateMessageActions)
  await app.register(deleteMessage)

  // Smart Notes
  await app.register(getSmartNotesStatus)
  await app.register(listSmartNotesFolders)
  await app.register(createSmartNotesFolder)
  await app.register(updateSmartNotesFolder)
  await app.register(deleteSmartNotesFolder)
  await app.register(listSmartNotes)
  await app.register(searchSmartNotes)
  await app.register(getSmartNote)
  await app.register(createSmartNote)
  await app.register(updateSmartNote)
  await app.register(deleteSmartNote)
  await app.register(smartNoteActions)
  await app.register(previewSmartNotesContext)

  // MCP Servers
  await app.register(listMcpServers)
  await app.register(createMcpServer)
  await app.register(getMcpServer)
  await app.register(updateMcpServer)
  await app.register(deleteMcpServer)
  await app.register(testMcpServer)
  await app.register(toggleMcpServer)
  await app.register(quickInstallMcpServer)

  // Skills
  await app.register(listSkills)
  await app.register(createSkill)
  await app.register(getSkill)
  await app.register(updateSkill)
  await app.register(deleteSkill)
  await app.register(toggleSkill)
  await app.register(importSkill)

  // Agents
  await app.register(listAgents)
  await app.register(createAgent)
  await app.register(getAgent)
  await app.register(updateAgent)
  await app.register(deleteAgent)
  await app.register(toggleAgent)
  await app.register(importAgent)

  // Rules
  await app.register(listRules)
  await app.register(createRule)
  await app.register(getRule)
  await app.register(updateRule)
  await app.register(deleteRule)
  await app.register(toggleRule)
  await app.register(importRule)

  // Plugins
  await app.register(listPlugins)
  await app.register(getPlugin)
  await app.register(installPlugin)
  await app.register(updatePlugin)
  await app.register(deletePlugin)
  await app.register(togglePlugin)
  await app.register(importPluginUrl)
  await app.register(resyncPlugin)

  // Settings
  await app.register(getSettings)
  await app.register(updateSettings)

  // Import repo (bulk)
  await app.register(importRepo)
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
