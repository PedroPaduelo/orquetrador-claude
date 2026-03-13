import type { FastifyInstance } from 'fastify'

import { authRoutes } from './auth/auth.routes.js'
import { healthRoutes } from './health/health.routes.js'
import { skillsRoutes } from './skills/skills.routes.js'
import { agentsRoutes } from './agents/agents.routes.js'
import { rulesRoutes } from './rules/rules.routes.js'
import { mcpServersRoutes } from './mcp-servers/mcp-servers.routes.js'
import { pluginsRoutes } from './plugins/plugins.routes.js'
import { workflowsRoutes } from './workflows/workflows.routes.js'
import { conversationsRoutes } from './conversations/conversations.routes.js'
import { executionRoutes } from './execution/execution.routes.js'
import { attachmentsRoutes } from './attachments/attachments.routes.js'
import { importRepoRoutes } from './import-repo/import-repo.routes.js'
import { hooksRoutes } from './hooks/hooks.routes.js'
import { gitRoutes } from './git/git.routes.js'
import { apiKeysRoutes } from './api-keys/api-keys.routes.js'
import { adminRoutes } from './admin/admin.routes.js'
import { stepTemplatesRoutes } from './step-templates/step-templates.routes.js'
import { promptVersionsRoutes } from './workflows/prompt-versions.routes.js'
import { webhooksRoutes } from './webhooks/webhooks.routes.js'
import { metricsRoutes } from './execution/metrics.routes.js'

export const domainRoutes: Array<(app: FastifyInstance) => Promise<void>> = [
  authRoutes,
  healthRoutes,
  skillsRoutes,
  agentsRoutes,
  rulesRoutes,
  mcpServersRoutes,
  pluginsRoutes,
  workflowsRoutes,
  conversationsRoutes,
  executionRoutes,
  attachmentsRoutes,
  importRepoRoutes,
  hooksRoutes,
  gitRoutes,
  apiKeysRoutes,
  adminRoutes,
  stepTemplatesRoutes,
  promptVersionsRoutes,
  webhooksRoutes,
  metricsRoutes,
]
