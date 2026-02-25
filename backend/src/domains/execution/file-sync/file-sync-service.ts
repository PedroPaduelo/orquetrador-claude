import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'fs'
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

interface HookData {
  eventType: string
  matcher: string | null
  handlerType: string
  command: string | null
  prompt: string | null
  timeout: number
  isAsync: boolean
  statusMessage: string | null
  enabled: boolean
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
        hooks: { include: { hook: true } },
      },
    })

    if (!step) return

    // Get global resources (enabled + isGlobal)
    const [globalServers, globalSkills, globalAgents, globalRules, globalHooks] = await Promise.all([
      prisma.mcpServer.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.skill.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.agent.findMany({ where: { enabled: true, isGlobal: true } }),
      prisma.rule.findMany({ where: { enabled: true, isGlobal: true }, include: { skill: { select: { name: true } } } }),
      prisma.hook.findMany({ where: { enabled: true, isGlobal: true } }),
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

    const stepHookIds = new Set(step.hooks.map((h) => h.hookId))
    const allHooks: HookData[] = [
      ...step.hooks.map((h) => h.hook).filter((h) => h.enabled),
      ...globalHooks.filter((h) => !stepHookIds.has(h.id)),
    ]

    // Sync directory isolation hook + user hooks to settings.json
    this.syncHooksToSettings(projectPath, allHooks)

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
   * Sync directory isolation hook script + all user hooks into settings.json
   */
  syncHooksToSettings(projectPath: string, userHooks: HookData[]): void {
    // 1. Write the directory isolation shell script
    const hookDir = join(projectPath, '.claude', 'hooks')
    const hookPath = join(hookDir, 'restrict-directory.sh')

    const hookScript = `#!/bin/bash
# Auto-generated by orchestrator - blocks file access outside project directory
# DO NOT EDIT - this file is overwritten on every execution
ALLOWED_DIR="${projectPath}"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

deny() {
  local REASON="$1"
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"'"$REASON"'"}}'
  exit 0
}

check_path() {
  local RAW_PATH="$1"
  if [ -z "$RAW_PATH" ]; then return 0; fi
  local RESOLVED
  RESOLVED=$(realpath -m "$RAW_PATH" 2>/dev/null || echo "$RAW_PATH")
  if [[ "$RESOLVED" != "$ALLOWED_DIR"* && "$RESOLVED" != "/tmp"* && "$RESOLVED" != "/dev/null" && "$RESOLVED" != "/proc"* ]]; then
    deny "Acesso negado: $RESOLVED esta fora do diretorio do projeto. Voce so pode acessar arquivos dentro de $ALLOWED_DIR"
  fi
}

case "$TOOL_NAME" in
  Read|Write|Edit)
    check_path "$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')"
    ;;
  Glob)
    TARGET=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
    if [ -n "$TARGET" ]; then check_path "$TARGET"; fi
    ;;
  Grep)
    TARGET=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
    if [ -n "$TARGET" ]; then check_path "$TARGET"; fi
    ;;
  Bash)
    CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
    if [ -n "$CWD" ] && [[ "$CWD" != "$ALLOWED_DIR"* ]]; then
      deny "Diretorio de trabalho $CWD esta fora do projeto $ALLOWED_DIR"
    fi
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    CD_TARGET=$(echo "$CMD" | grep -oP '(?<=cd\\s)/[^\\s;&|"]+' | head -1)
    if [ -n "$CD_TARGET" ]; then check_path "$CD_TARGET"; fi
    CD_REL=$(echo "$CMD" | grep -oP '(?<=cd\\s)\\.\\.[^\\s;&|"]*' | head -1)
    if [ -n "$CD_REL" ] && [ -n "$CWD" ]; then
      check_path "$CWD/$CD_REL"
    fi
    for ABS_PATH in $(echo "$CMD" | grep -oP '(?:^|\\s)/[a-zA-Z][^\\s;&|"]*' || true); do
      RESOLVED=$(realpath -m "$ABS_PATH" 2>/dev/null || echo "$ABS_PATH")
      if [[ "$RESOLVED" != "$ALLOWED_DIR"* && "$RESOLVED" != "/tmp"* && "$RESOLVED" != "/dev"* && "$RESOLVED" != "/proc"* && "$RESOLVED" != "/usr"* && "$RESOLVED" != "/bin"* && "$RESOLVED" != "/etc"* && "$RESOLVED" != "/home"* ]]; then
        deny "Acesso negado: comando referencia $RESOLVED que esta fora de $ALLOWED_DIR"
      fi
    done
    ;;
esac

exit 0
`
    this.syncFile(hookPath, hookScript)
    try { chmodSync(hookPath, 0o755) } catch { /* ignore */ }

    // 2. Build hooks config merging isolation hook + user hooks
    const hooksConfig: Record<string, Array<{ matcher?: string; hooks: Array<Record<string, unknown>> }>> = {}

    // Add directory isolation hook first (always present)
    hooksConfig.PreToolUse = [
      {
        matcher: 'Read|Edit|Write|Glob|Grep|Bash',
        hooks: [
          {
            type: 'command',
            command: hookPath,
          },
        ],
      },
    ]

    // Add user hooks grouped by event + matcher
    for (const hook of userHooks) {
      if (!hook.enabled) continue

      if (!hooksConfig[hook.eventType]) {
        hooksConfig[hook.eventType] = []
      }

      const matcherKey = hook.matcher || '__no_matcher__'
      let group = hooksConfig[hook.eventType].find(g =>
        (g.matcher || '__no_matcher__') === matcherKey
      )

      if (!group) {
        group = { hooks: [] }
        if (hook.matcher) group.matcher = hook.matcher
        hooksConfig[hook.eventType].push(group)
      }

      const hookEntry: Record<string, unknown> = {
        type: hook.handlerType,
        timeout: hook.timeout,
      }

      if (hook.handlerType === 'command' && hook.command) {
        hookEntry.command = hook.command
      }
      if ((hook.handlerType === 'prompt' || hook.handlerType === 'agent') && hook.prompt) {
        hookEntry.prompt = hook.prompt
      }
      if (hook.isAsync) hookEntry.isAsync = true
      if (hook.statusMessage) hookEntry.statusMessage = hook.statusMessage

      group.hooks.push(hookEntry)
    }

    // 3. Write settings.json
    const settingsPath = join(projectPath, '.claude', 'settings.json')
    let settings: Record<string, unknown> = {}

    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      } catch { /* start fresh */ }
    }

    settings.hooks = hooksConfig

    const settingsContent = JSON.stringify(settings, null, 2)
    this.syncFile(settingsPath, settingsContent)
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
