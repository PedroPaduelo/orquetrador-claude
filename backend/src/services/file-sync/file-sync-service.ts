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

    // Write ALL MCP servers to .mcp.json (stdio, http, sse)
    if (allServers.length > 0) {
      this.writeMcpConfig(projectPath, allServers)
    }

    // Write skill files
    for (const skill of allSkills) {
      this.writeSkillFile(projectPath, skill)
    }

    // Write agent files
    for (const agent of allAgents) {
      this.writeAgentFile(projectPath, agent)
    }
  }

  /**
   * Write .mcp.json with all MCP server types.
   * Claude Code schema:
   * - stdio: { command, args, env }
   * - http:  { type: "http", url, headers }
   * - sse:   { type: "sse", url, headers }
   */
  writeMcpConfig(projectPath: string, servers: McpServerData[]): void {
    const mcpServers: Record<string, unknown> = {}

    for (const server of servers) {
      const envVars = safeJsonParse<Record<string, string>>(server.envVars, {})

      if (server.type === 'stdio' && server.command) {
        const args = safeJsonParse<string[]>(server.args, [])
        const entry: Record<string, unknown> = {
          command: server.command,
          args,
        }
        // env is only valid for stdio servers
        if (Object.keys(envVars).length > 0) {
          entry.env = envVars
        }
        mcpServers[server.name] = entry
      } else if ((server.type === 'http' || server.type === 'sse') && server.uri) {
        const entry: Record<string, unknown> = {
          type: server.type, // "http" or "sse"
          url: server.uri,
        }
        // For remote servers, env vars go as headers (e.g. Authorization)
        if (Object.keys(envVars).length > 0) {
          entry.headers = envVars
        }
        mcpServers[server.name] = entry
      }
    }

    const configPath = join(projectPath, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({ mcpServers }, null, 2), 'utf-8')
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
