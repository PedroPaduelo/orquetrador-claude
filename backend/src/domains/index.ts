import type { FastifyInstance } from 'fastify'

import { healthRoutes } from './health/health.routes.js'
import { settingsRoutes } from './settings/settings.routes.js'
import { skillsRoutes } from './skills/skills.routes.js'
import { agentsRoutes } from './agents/agents.routes.js'
import { rulesRoutes } from './rules/rules.routes.js'
import { mcpServersRoutes } from './mcp-servers/mcp-servers.routes.js'
import { pluginsRoutes } from './plugins/plugins.routes.js'
import { workflowsRoutes } from './workflows/workflows.routes.js'
import { conversationsRoutes } from './conversations/conversations.routes.js'
import { executionRoutes } from './execution/execution.routes.js'
import { smartNotesRoutes } from './smart-notes/smart-notes.routes.js'
import { attachmentsRoutes } from './attachments/attachments.routes.js'
import { importRepoRoutes } from './import-repo/import-repo.routes.js'

export const domainRoutes: Array<(app: FastifyInstance) => Promise<void>> = [
  healthRoutes,
  settingsRoutes,
  skillsRoutes,
  agentsRoutes,
  rulesRoutes,
  mcpServersRoutes,
  pluginsRoutes,
  workflowsRoutes,
  conversationsRoutes,
  executionRoutes,
  smartNotesRoutes,
  attachmentsRoutes,
  importRepoRoutes,
]
