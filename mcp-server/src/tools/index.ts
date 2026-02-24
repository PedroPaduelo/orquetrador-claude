import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerWorkflowTools } from './workflows.js'
import { registerAgentTools } from './agents.js'
import { registerSkillTools } from './skills.js'
import { registerRuleTools } from './rules.js'
import { registerMcpServerTools } from './mcp-servers.js'
import { registerPluginTools } from './plugins.js'
import { registerConversationTools } from './conversations.js'
import { registerExecutionTraceTools } from './execution-traces.js'
import { registerSmartNoteTools } from './smart-notes.js'
import { registerSystemTools } from './system.js'

export function registerAllTools(server: McpServer) {
  registerSystemTools(server)
  registerWorkflowTools(server)
  registerAgentTools(server)
  registerSkillTools(server)
  registerRuleTools(server)
  registerMcpServerTools(server)
  registerPluginTools(server)
  registerConversationTools(server)
  registerExecutionTraceTools(server)
  registerSmartNoteTools(server)
}
