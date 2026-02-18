import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { prisma } from '../../lib/prisma.js'

interface McpServerData {
  id: string
  name: string
  type: string
  uri?: string | null
  command?: string | null
  args: string
  envVars: string
}

interface SkillData {
  name: string
  description?: string | null
  frontmatter: string
  body: string
  allowedTools: string
  model?: string | null
}

interface AgentData {
  name: string
  description?: string | null
  systemPrompt: string
  tools: string
  disallowedTools: string
  model?: string | null
  permissionMode: string
  maxTurns?: number | null
  skills: string
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export class FileSyncService {
  /**
   * Sync all resources for a workflow step before execution.
   * Writes .mcp.json, skill files, and agent files to the project directory.
   */
  async syncForStep(projectPath: string, stepId: string): Promise<void> {
    // Get step with its assigned resources
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        mcpServers: { include: { server: true } },
        skills: { include: { skill: true } },
        agents: { include: { agent: true } },
      },
    })

    if (!step) return

    // Get global resources (enabled + isGlobal)
    const [globalServers, globalSkills, globalAgents] = await Promise.all([
      prisma.mcpServer.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.skill.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.agent.findMany({ where: { enabled: true, isGlobal: true } }),
    ])

    // Merge step-specific + global (dedupe by id)
    const stepServerIds = new Set(step.mcpServers.map((s) => s.serverId))
    const allServers = [
      ...step.mcpServers.map((s) => s.server).filter((s) => s.enabled),
      ...globalServers.filter((s) => !stepServerIds.has(s.id)),
    ]

    const stepSkillIds = new Set(step.skills.map((s) => s.skillId))
    const allSkills = [
      ...step.skills.map((s) => s.skill).filter((s) => s.enabled),
      ...globalSkills.filter((s) => !stepSkillIds.has(s.id)),
    ]

    const stepAgentIds = new Set(step.agents.map((s) => s.agentId))
    const allAgents = [
      ...step.agents.map((s) => s.agent).filter((s) => s.enabled),
      ...globalAgents.filter((s) => !stepAgentIds.has(s.id)),
    ]

    // Write stdio MCP servers to .mcp.json
    const stdioServers = allServers.filter((s) => s.type === 'stdio')
    if (stdioServers.length > 0) {
      this.writeMcpConfig(projectPath, stdioServers)
    }

    // Write skill files
    for (const skill of allSkills) {
      this.writeSkillFile(projectPath, skill)
    }

    // Write agent files
    for (const agent of allAgents) {
      this.writeAgentFile(projectPath, agent)
    }

    // Return HTTP/SSE servers for CLI flags (they don't need filesystem)
    // This is handled by the caller via getHttpServers()
  }

  /**
   * Get HTTP/SSE MCP servers for a step (to pass as --mcp-server-uri flags)
   */
  async getHttpServersForStep(stepId: string): Promise<McpServerData[]> {
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        mcpServers: { include: { server: true } },
      },
    })

    if (!step) return []

    const globalServers = await prisma.mcpServer.findMany({
      where: { enabled: true, isGlobal: true },
    })

    const stepServerIds = new Set(step.mcpServers.map((s) => s.serverId))
    const allServers = [
      ...step.mcpServers.map((s) => s.server).filter((s) => s.enabled),
      ...globalServers.filter((s) => !stepServerIds.has(s.id)),
    ]

    return allServers.filter((s) => s.type === 'http' || s.type === 'sse')
  }

  /**
   * Write .mcp.json for stdio MCP servers
   */
  writeMcpConfig(projectPath: string, servers: McpServerData[]): void {
    const mcpConfig: Record<string, unknown> = {
      mcpServers: {} as Record<string, unknown>,
    }

    for (const server of servers) {
      if (server.type !== 'stdio' || !server.command) continue

      const args = safeJsonParse<string[]>(server.args, [])
      const env = safeJsonParse<Record<string, string>>(server.envVars, {})

      ;(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
        command: server.command,
        args,
        env: Object.keys(env).length > 0 ? env : undefined,
      }
    }

    const configPath = join(projectPath, '.mcp.json')
    writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2), 'utf-8')
  }

  /**
   * Write a skill file to .claude/skills/{name}/SKILL.md
   */
  writeSkillFile(projectPath: string, skill: SkillData): void {
    const skillDir = join(projectPath, '.claude', 'skills', skill.name)
    mkdirSync(skillDir, { recursive: true })

    const allowedTools = safeJsonParse<string[]>(skill.allowedTools, [])

    // Build frontmatter
    const frontmatterLines: string[] = ['---']
    frontmatterLines.push(`name: ${skill.name}`)
    if (skill.description) {
      frontmatterLines.push(`description: ${skill.description}`)
    }
    if (allowedTools.length > 0) {
      frontmatterLines.push('allowed-tools:')
      for (const tool of allowedTools) {
        frontmatterLines.push(`  - ${tool}`)
      }
    }
    if (skill.model) {
      frontmatterLines.push(`model: ${skill.model}`)
    }
    frontmatterLines.push('---')

    const content = frontmatterLines.join('\n') + '\n\n' + skill.body

    writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
  }

  /**
   * Write an agent file to .claude/agents/{name}/agent.md
   */
  writeAgentFile(projectPath: string, agent: AgentData): void {
    const agentDir = join(projectPath, '.claude', 'agents', agent.name)
    mkdirSync(agentDir, { recursive: true })

    const tools = safeJsonParse<string[]>(agent.tools, [])
    const disallowedTools = safeJsonParse<string[]>(agent.disallowedTools, [])
    const skills = safeJsonParse<string[]>(agent.skills, [])

    // Build frontmatter
    const frontmatterLines: string[] = ['---']
    frontmatterLines.push(`name: ${agent.name}`)
    if (agent.description) {
      frontmatterLines.push(`description: ${agent.description}`)
    }
    if (agent.model) {
      frontmatterLines.push(`model: ${agent.model}`)
    }
    if (agent.permissionMode && agent.permissionMode !== 'default') {
      frontmatterLines.push(`permission-mode: ${agent.permissionMode}`)
    }
    if (agent.maxTurns) {
      frontmatterLines.push(`max-turns: ${agent.maxTurns}`)
    }
    if (tools.length > 0) {
      frontmatterLines.push('tools:')
      for (const tool of tools) {
        frontmatterLines.push(`  - ${tool}`)
      }
    }
    if (disallowedTools.length > 0) {
      frontmatterLines.push('disallowed-tools:')
      for (const tool of disallowedTools) {
        frontmatterLines.push(`  - ${tool}`)
      }
    }
    if (skills.length > 0) {
      frontmatterLines.push('skills:')
      for (const s of skills) {
        frontmatterLines.push(`  - ${s}`)
      }
    }
    frontmatterLines.push('---')

    const content = frontmatterLines.join('\n') + '\n\n' + agent.systemPrompt

    writeFileSync(join(agentDir, 'agent.md'), content, 'utf-8')
  }

  /**
   * Remove an orphan skill file
   */
  cleanSkillFile(projectPath: string, skillName: string): void {
    const skillDir = join(projectPath, '.claude', 'skills', skillName)
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true })
    }
  }

  /**
   * Remove an orphan agent file
   */
  cleanAgentFile(projectPath: string, agentName: string): void {
    const agentDir = join(projectPath, '.claude', 'agents', agentName)
    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true })
    }
  }
}

export const fileSyncService = new FileSyncService()
