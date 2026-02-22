import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { prisma } from '../../../lib/prisma.js'

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
  source: string
  fileManifest: string
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

interface RuleData {
  name: string
  body: string
  skillName?: string | null
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
   * Write a file only if it doesn't exist or its content differs.
   * Returns true if the file was written, false if already up-to-date.
   */
  private syncFile(filePath: string, expectedContent: string): boolean {
    if (existsSync(filePath)) {
      const currentContent = readFileSync(filePath, 'utf-8')
      if (currentContent === expectedContent) return false
    }
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, expectedContent, 'utf-8')
    return true
  }

  /**
   * Sync all resources for a workflow step before execution.
   * DB is the source of truth - all resources are synced to filesystem.
   */
  async syncForStep(projectPath: string, stepId: string): Promise<void> {
    // Get step with its assigned resources (including rules)
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        mcpServers: { include: { server: true } },
        skills: { include: { skill: true } },
        agents: { include: { agent: true } },
        rules: { include: { rule: { include: { skill: { select: { name: true } } } } } },
      },
    })

    if (!step) return

    // Get global resources (enabled + isGlobal)
    const [globalServers, globalSkills, globalAgents, globalRules] = await Promise.all([
      prisma.mcpServer.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.skill.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.agent.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.rule.findMany({ where: { enabled: true, isGlobal: true }, include: { skill: { select: { name: true } } } }),
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

    const stepRuleIds = new Set(step.rules.map((r) => r.ruleId))
    const allRules = [
      ...step.rules.map((r) => r.rule).filter((r) => r.enabled),
      ...globalRules.filter((r) => !stepRuleIds.has(r.id)),
    ]

    // Sync ALL MCP servers to .mcp.json
    if (allServers.length > 0) {
      this.syncMcpConfig(projectPath, allServers)
    }

    // Sync ALL skills (DB is truth, no source check)
    for (const skill of allSkills) {
      this.syncSkillFile(projectPath, skill)
    }

    // Sync ALL agents (DB is truth, no source check)
    for (const agent of allAgents) {
      this.syncAgentFile(projectPath, agent)
    }

    // Sync ALL rules
    for (const rule of allRules) {
      this.syncRuleFile(projectPath, {
        name: rule.name,
        body: rule.body,
        skillName: rule.skill?.name ?? null,
      })
    }
  }

  /**
   * Sync .mcp.json with all MCP server types.
   */
  syncMcpConfig(projectPath: string, servers: McpServerData[]): void {
    const mcpServers: Record<string, unknown> = {}

    for (const server of servers) {
      const envVars = safeJsonParse<Record<string, string>>(server.envVars, {})

      if (server.type === 'stdio' && server.command) {
        const args = safeJsonParse<string[]>(server.args, [])
        const entry: Record<string, unknown> = {
          command: server.command,
          args,
        }
        if (Object.keys(envVars).length > 0) {
          entry.env = envVars
        }
        mcpServers[server.name] = entry
      } else if ((server.type === 'http' || server.type === 'sse') && server.uri) {
        const entry: Record<string, unknown> = {
          type: server.type,
          url: server.uri,
        }
        if (Object.keys(envVars).length > 0) {
          entry.headers = envVars
        }
        mcpServers[server.name] = entry
      }
    }

    const configPath = join(projectPath, '.mcp.json')
    const content = JSON.stringify({ mcpServers }, null, 2)
    this.syncFile(configPath, content)
  }

  /**
   * Sync a skill to .claude/skills/{name}/
   * For imported skills with fileManifest: writes ALL files from the manifest.
   * For manual skills: reconstructs SKILL.md from DB fields.
   */
  syncSkillFile(projectPath: string, skill: SkillData): void {
    const manifest = safeJsonParse<Array<{ path: string; content: string }>>(skill.fileManifest, [])

    if (skill.source === 'imported' && manifest.length > 0) {
      // Imported skill: write ALL files from manifest
      for (const file of manifest) {
        const filePath = join(projectPath, '.claude', 'skills', skill.name, file.path)
        this.syncFile(filePath, file.content)
      }
    } else {
      // Manual skill: reconstruct SKILL.md from DB fields
      const allowedTools = safeJsonParse<string[]>(skill.allowedTools, [])

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
      const filePath = join(projectPath, '.claude', 'skills', skill.name, 'SKILL.md')
      this.syncFile(filePath, content)
    }
  }

  /**
   * Sync an agent file to .claude/agents/{name}/agent.md
   */
  syncAgentFile(projectPath: string, agent: AgentData): void {
    const tools = safeJsonParse<string[]>(agent.tools, [])
    const disallowedTools = safeJsonParse<string[]>(agent.disallowedTools, [])
    const skills = safeJsonParse<string[]>(agent.skills, [])

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
    const filePath = join(projectPath, '.claude', 'agents', agent.name, 'agent.md')
    this.syncFile(filePath, content)
  }

  /**
   * Sync a rule file to .claude/rules/{name}.md or .claude/skills/{skillName}/rules/{name}.md
   */
  syncRuleFile(projectPath: string, rule: RuleData): void {
    let filePath: string
    if (rule.skillName) {
      filePath = join(projectPath, '.claude', 'skills', rule.skillName, 'rules', `${rule.name}.md`)
    } else {
      filePath = join(projectPath, '.claude', 'rules', `${rule.name}.md`)
    }
    this.syncFile(filePath, rule.body)
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

  /**
   * Remove an orphan rule file
   */
  cleanRuleFile(projectPath: string, ruleName: string, skillName?: string | null): void {
    let filePath: string
    if (skillName) {
      filePath = join(projectPath, '.claude', 'skills', skillName, 'rules', `${ruleName}.md`)
    } else {
      filePath = join(projectPath, '.claude', 'rules', `${ruleName}.md`)
    }
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true })
    }
  }
}

export const fileSyncService = new FileSyncService()
