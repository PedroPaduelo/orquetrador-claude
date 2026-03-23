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
import { auditLogRoutes } from './admin/audit-log.routes.js'
import { stepTemplatesRoutes } from './step-templates/step-templates.routes.js'
import { promptVersionsRoutes } from './workflows/prompt-versions.routes.js'
import { webhooksRoutes } from './webhooks/webhooks.routes.js'
import { metricsRoutes } from './execution/metrics.routes.js'
import { workflowApiRoutes } from './workflows/workflow-api.routes.js'
import { workflowVersionsRoutes } from './workflows/workflow-versions.routes.js'
import { tagsRoutes } from './tags/tags.routes.js'
import { metricsAggregatorRoutes } from './execution/monitoring/metrics-aggregator.routes.js'
import { executionRatingsRoutes } from './execution/monitoring/execution-ratings.routes.js'
import { hourlyTokenUsageRoutes } from './execution/monitoring/hourly-token-usage.routes.js'
import { resourcePerformanceRoutes } from './execution/monitoring/resource-performance.routes.js'
import { gitSourceRoutes } from './resources/git-source.routes.js'
import { feedbackRoutes } from './conversations/feedback.routes.js'
import { resourceDependencyRoutes } from './workflows/resource-dependency.routes.js'
import { triggersRoutes } from './triggers/triggers.routes.js'

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
  auditLogRoutes,
  stepTemplatesRoutes,
  promptVersionsRoutes,
  webhooksRoutes,
  metricsRoutes,
  workflowApiRoutes,
  workflowVersionsRoutes,
  tagsRoutes,
  metricsAggregatorRoutes,
  executionRatingsRoutes,
  hourlyTokenUsageRoutes,
  resourcePerformanceRoutes,
  gitSourceRoutes,
  feedbackRoutes,
  resourceDependencyRoutes,
  triggersRoutes,
]
