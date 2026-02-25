import { hooksRepository } from './hooks.repository.js'

// All 16 Claude Code hook events
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'UserPromptSubmit',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
  'PermissionRequest',
  'TeammateIdle',
  'TaskCompleted',
  'PreCompact',
  'WorktreeCreate',
  'WorktreeRemove',
] as const

export type HookEvent = typeof HOOK_EVENTS[number]

// Event metadata for UI
export const HOOK_EVENT_INFO: Record<string, {
  label: string
  description: string
  supportsMatcher: boolean
  matcherLabel?: string
  matcherHint?: string
  category: 'tools' | 'lifecycle' | 'workflow' | 'system'
}> = {
  PreToolUse: {
    label: 'Pre Tool Use',
    description: 'Executado ANTES de uma ferramenta ser chamada. Pode bloquear a execucao.',
    supportsMatcher: true,
    matcherLabel: 'Nome da ferramenta',
    matcherHint: 'Ex: Bash, Write, Edit (regex)',
    category: 'tools',
  },
  PostToolUse: {
    label: 'Post Tool Use',
    description: 'Executado DEPOIS de uma ferramenta ser usada com sucesso.',
    supportsMatcher: true,
    matcherLabel: 'Nome da ferramenta',
    matcherHint: 'Ex: Bash, Write, Edit (regex)',
    category: 'tools',
  },
  PostToolUseFailure: {
    label: 'Post Tool Use (Falha)',
    description: 'Executado quando uma ferramenta falha.',
    supportsMatcher: true,
    matcherLabel: 'Nome da ferramenta',
    matcherHint: 'Ex: Bash, Write, Edit (regex)',
    category: 'tools',
  },
  PermissionRequest: {
    label: 'Permission Request',
    description: 'Executado quando uma ferramenta pede permissao ao usuario.',
    supportsMatcher: true,
    matcherLabel: 'Nome da ferramenta',
    matcherHint: 'Ex: Bash, Write (regex)',
    category: 'tools',
  },
  Stop: {
    label: 'Stop',
    description: 'Executado quando o Claude termina de responder. Pode forcar continuacao.',
    supportsMatcher: true,
    matcherLabel: 'Motivo de parada',
    matcherHint: 'Ex: end_turn, max_tokens',
    category: 'lifecycle',
  },
  UserPromptSubmit: {
    label: 'User Prompt Submit',
    description: 'Executado quando o usuario envia uma mensagem. Pode modificar o prompt.',
    supportsMatcher: false,
    category: 'lifecycle',
  },
  Notification: {
    label: 'Notificacao',
    description: 'Executado quando o Claude envia uma notificacao.',
    supportsMatcher: false,
    category: 'lifecycle',
  },
  SubagentStart: {
    label: 'Subagent Start',
    description: 'Executado quando um subagente e iniciado.',
    supportsMatcher: true,
    matcherLabel: 'Tipo do subagente',
    matcherHint: 'Ex: Bash, general-purpose',
    category: 'workflow',
  },
  SubagentStop: {
    label: 'Subagent Stop',
    description: 'Executado quando um subagente termina.',
    supportsMatcher: true,
    matcherLabel: 'Tipo do subagente',
    matcherHint: 'Ex: Bash, general-purpose',
    category: 'workflow',
  },
  SessionStart: {
    label: 'Session Start',
    description: 'Executado no inicio de uma sessao Claude.',
    supportsMatcher: false,
    category: 'lifecycle',
  },
  SessionEnd: {
    label: 'Session End',
    description: 'Executado no final de uma sessao Claude.',
    supportsMatcher: false,
    category: 'lifecycle',
  },
  TeammateIdle: {
    label: 'Teammate Idle',
    description: 'Executado quando um teammate fica inativo.',
    supportsMatcher: false,
    category: 'workflow',
  },
  TaskCompleted: {
    label: 'Task Completed',
    description: 'Executado quando uma tarefa e concluida.',
    supportsMatcher: false,
    category: 'workflow',
  },
  PreCompact: {
    label: 'Pre Compact',
    description: 'Executado antes da compactacao de contexto.',
    supportsMatcher: false,
    category: 'system',
  },
  WorktreeCreate: {
    label: 'Worktree Create',
    description: 'Executado quando um worktree git e criado.',
    supportsMatcher: false,
    category: 'system',
  },
  WorktreeRemove: {
    label: 'Worktree Remove',
    description: 'Executado quando um worktree git e removido.',
    supportsMatcher: false,
    category: 'system',
  },
}

// Built-in templates
export interface HookTemplate {
  id: string
  name: string
  description: string
  eventType: string
  matcher: string | null
  handlerType: string
  command: string | null
  prompt: string | null
  timeout: number
  isAsync: boolean
  statusMessage: string | null
}

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: 'block-rm-rf',
    name: 'Bloquear rm -rf',
    description: 'Impede comandos destrutivos como rm -rf',
    eventType: 'PreToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'if echo "$TOOL_INPUT" | grep -qE "rm\\s+(-rf|-r\\s+-f|--recursive)\\s+/"; then echo \'{"decision":"block","reason":"Comando rm -rf bloqueado por seguranca"}\' >&2; exit 2; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Verificando seguranca do comando...',
  },
  {
    id: 'auto-lint',
    name: 'Auto Lint',
    description: 'Roda linter automaticamente apos editar arquivos',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'npx eslint --fix "$TOOL_INPUT_FILE_PATH" 2>/dev/null || true',
    prompt: null,
    timeout: 30000,
    isAsync: true,
    statusMessage: 'Rodando linter...',
  },
  {
    id: 'auto-format',
    name: 'Auto Format',
    description: 'Formata o codigo automaticamente apos editar',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'npx prettier --write "$TOOL_INPUT_FILE_PATH" 2>/dev/null || true',
    prompt: null,
    timeout: 15000,
    isAsync: true,
    statusMessage: 'Formatando codigo...',
  },
  {
    id: 'log-operations',
    name: 'Log de Operacoes',
    description: 'Registra todas as operacoes de ferramentas em um log',
    eventType: 'PostToolUse',
    matcher: null,
    handlerType: 'command',
    command: 'echo "[$(date +%H:%M:%S)] $TOOL_NAME: $TOOL_INPUT_FILE_PATH" >> /tmp/claude-hooks.log',
    prompt: null,
    timeout: 5000,
    isAsync: true,
    statusMessage: 'Registrando operacao...',
  },
  {
    id: 'block-secrets',
    name: 'Bloquear Secrets',
    description: 'Impede escrita de arquivos com secrets (.env, credentials)',
    eventType: 'PreToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'if echo "$TOOL_INPUT_FILE_PATH" | grep -qE "\\.(env|pem|key)$|credentials|secrets"; then echo \'{"decision":"block","reason":"Escrita em arquivo sensivel bloqueada"}\' >&2; exit 2; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Verificando arquivo sensivel...',
  },
  {
    id: 'auto-test',
    name: 'Auto Test',
    description: 'Roda testes apos modificacoes em arquivos de codigo',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'npm test -- --passWithNoTests 2>/dev/null || true',
    prompt: null,
    timeout: 60000,
    isAsync: true,
    statusMessage: 'Rodando testes...',
  },
  {
    id: 'git-auto-stage',
    name: 'Git Auto Stage',
    description: 'Adiciona arquivos ao staging automaticamente apos editar',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'git add "$TOOL_INPUT_FILE_PATH" 2>/dev/null || true',
    prompt: null,
    timeout: 5000,
    isAsync: true,
    statusMessage: 'Adicionando ao staging...',
  },
  {
    id: 'review-prompt',
    name: 'Revisar Mudancas',
    description: 'Pede ao Claude para revisar mudancas antes de commitar',
    eventType: 'PreToolUse',
    matcher: 'Bash',
    handlerType: 'prompt',
    command: null,
    prompt: 'O usuario esta prestes a executar um comando Bash. Revise o comando e decida se e seguro. Bloqueie comandos destrutivos ou que possam causar danos.',
    timeout: 30000,
    isAsync: false,
    statusMessage: 'Revisando comando...',
  },
  // =============================================
  // NOVOS TEMPLATES - Seguranca
  // =============================================
  {
    id: 'block-force-push',
    name: 'Bloquear Force Push',
    description: 'Impede git push --force e git push -f para proteger o historico remoto',
    eventType: 'PreToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r \'.tool_input.command // empty\'); if echo "$CMD" | grep -qE "git\\s+push\\s+.*(-f|--force)"; then echo \'{"decision":"block","reason":"Force push bloqueado. Use git push normal."}\' >&2; exit 2; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Verificando git push...',
  },
  {
    id: 'block-drop-table',
    name: 'Bloquear DROP TABLE',
    description: 'Impede execucao de comandos SQL destrutivos (DROP, TRUNCATE, DELETE sem WHERE)',
    eventType: 'PreToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r \'.tool_input.command // empty\'); if echo "$CMD" | grep -qiE "(DROP\\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\\s+TABLE|DELETE\\s+FROM\\s+\\w+\\s*$)"; then echo \'{"decision":"block","reason":"Comando SQL destrutivo bloqueado por seguranca"}\' >&2; exit 2; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Verificando SQL...',
  },
  {
    id: 'block-npm-publish',
    name: 'Bloquear npm publish',
    description: 'Impede publicacao acidental de pacotes no npm',
    eventType: 'PreToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r \'.tool_input.command // empty\'); if echo "$CMD" | grep -qE "npm\\s+publish"; then echo \'{"decision":"block","reason":"npm publish bloqueado. Publique manualmente."}\' >&2; exit 2; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Verificando npm...',
  },
  // =============================================
  // NOVOS TEMPLATES - Qualidade de Codigo
  // =============================================
  {
    id: 'typecheck-on-edit',
    name: 'TypeScript Check',
    description: 'Roda verificacao de tipos TypeScript apos editar arquivos .ts/.tsx',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if echo "$FILE" | grep -qE "\\.(ts|tsx)$"; then npx tsc --noEmit 2>&1 | head -20 || true; fi',
    prompt: null,
    timeout: 30000,
    isAsync: true,
    statusMessage: 'Verificando tipos TypeScript...',
  },
  {
    id: 'validate-json',
    name: 'Validar JSON',
    description: 'Valida sintaxe de arquivos JSON apos editar',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if echo "$FILE" | grep -qE "\\.json$"; then python3 -m json.tool "$FILE" > /dev/null 2>&1 || echo "JSON invalido: $FILE"; fi',
    prompt: null,
    timeout: 5000,
    isAsync: true,
    statusMessage: 'Validando JSON...',
  },
  // =============================================
  // NOVOS TEMPLATES - Git & Versionamento
  // =============================================
  {
    id: 'git-auto-commit',
    name: 'Git Auto Commit',
    description: 'Cria commit automatico apos cada edicao com mensagem descritiva',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; git add "$FILE" 2>/dev/null && git commit -m "auto: update $(basename $FILE)" --no-verify 2>/dev/null || true',
    prompt: null,
    timeout: 10000,
    isAsync: true,
    statusMessage: 'Commitando alteracao...',
  },
  {
    id: 'backup-before-edit',
    name: 'Backup Antes de Editar',
    description: 'Cria copia de backup do arquivo antes de qualquer edicao',
    eventType: 'PreToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r \'.tool_input.file_path // empty\'); if [ -n "$FILE" ] && [ -f "$FILE" ]; then mkdir -p /tmp/claude-backups && cp "$FILE" "/tmp/claude-backups/$(basename $FILE).$(date +%H%M%S).bak"; fi',
    prompt: null,
    timeout: 5000,
    isAsync: false,
    statusMessage: 'Criando backup...',
  },
  // =============================================
  // NOVOS TEMPLATES - Monitoramento & Logs
  // =============================================
  {
    id: 'log-commands',
    name: 'Log de Comandos',
    description: 'Registra todos os comandos Bash executados com timestamp',
    eventType: 'PostToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'echo "[$(date +%Y-%m-%d\\ %H:%M:%S)] BASH: $TOOL_INPUT" >> /tmp/claude-commands.log',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Registrando comando...',
  },
  {
    id: 'log-file-changes',
    name: 'Log de Arquivos Alterados',
    description: 'Registra cada arquivo criado ou editado com timestamp e tamanho',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; SIZE=$(wc -c < "$FILE" 2>/dev/null || echo "?"); echo "[$(date +%Y-%m-%d\\ %H:%M:%S)] $TOOL_NAME: $FILE (${SIZE} bytes)" >> /tmp/claude-file-changes.log',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Registrando alteracao...',
  },
  {
    id: 'session-start-log',
    name: 'Log de Inicio de Sessao',
    description: 'Registra quando uma sessao Claude inicia com data e diretorio',
    eventType: 'SessionStart',
    matcher: null,
    handlerType: 'command',
    command: 'echo "=== Sessao iniciada em $(date +%Y-%m-%d\\ %H:%M:%S) ===" >> /tmp/claude-sessions.log && echo "Diretorio: $(pwd)" >> /tmp/claude-sessions.log',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Registrando inicio de sessao...',
  },
  // =============================================
  // NOVOS TEMPLATES - Produtividade
  // =============================================
  {
    id: 'notify-on-stop',
    name: 'Notificar ao Finalizar',
    description: 'Toca um beep sonoro quando o Claude termina uma resposta longa',
    eventType: 'Stop',
    matcher: null,
    handlerType: 'command',
    command: 'echo -e "\\a" 2>/dev/null || true',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Notificando...',
  },
  {
    id: 'count-tokens-estimate',
    name: 'Estimar Tamanho de Arquivo',
    description: 'Apos editar, mostra quantas linhas e palavras o arquivo tem',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if [ -f "$FILE" ]; then LINES=$(wc -l < "$FILE"); WORDS=$(wc -w < "$FILE"); echo "Arquivo: $(basename $FILE) - $LINES linhas, $WORDS palavras"; fi',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Calculando metricas...',
  },
  {
    id: 'prevent-large-files',
    name: 'Bloquear Arquivos Grandes',
    description: 'Impede criacao de arquivos com mais de 500 linhas (incentiva modularizacao)',
    eventType: 'PostToolUse',
    matcher: 'Write',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if [ -f "$FILE" ]; then LINES=$(wc -l < "$FILE"); if [ "$LINES" -gt 500 ]; then echo "AVISO: $FILE tem $LINES linhas. Considere dividir em modulos menores." >&2; fi; fi',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Verificando tamanho...',
  },
  {
    id: 'auto-install-deps',
    name: 'Auto Install Deps',
    description: 'Roda npm install automaticamente quando package.json e editado',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if echo "$FILE" | grep -qE "package\\.json$"; then npm install 2>/dev/null || true; fi',
    prompt: null,
    timeout: 60000,
    isAsync: true,
    statusMessage: 'Instalando dependencias...',
  },
  {
    id: 'auto-prisma-generate',
    name: 'Auto Prisma Generate',
    description: 'Roda prisma generate automaticamente quando schema.prisma e editado',
    eventType: 'PostToolUse',
    matcher: 'Write|Edit',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; if echo "$FILE" | grep -qE "schema\\.prisma$"; then npx prisma generate 2>/dev/null || true; fi',
    prompt: null,
    timeout: 30000,
    isAsync: true,
    statusMessage: 'Gerando Prisma Client...',
  },
  {
    id: 'enforce-conventions',
    name: 'Verificar Convencoes',
    description: 'Verifica se arquivos novos seguem convencoes de nomenclatura (kebab-case)',
    eventType: 'PostToolUse',
    matcher: 'Write',
    handlerType: 'command',
    command: 'FILE="$TOOL_INPUT_FILE_PATH"; BASENAME=$(basename "$FILE"); if echo "$BASENAME" | grep -qE "[A-Z]" && echo "$BASENAME" | grep -qE "\\.(ts|tsx|js|jsx)$"; then echo "AVISO: $BASENAME usa PascalCase/camelCase. Considere usar kebab-case para nomes de arquivo." >&2; fi',
    prompt: null,
    timeout: 3000,
    isAsync: true,
    statusMessage: 'Verificando convencoes...',
  },
]

export const hooksService = {
  getTemplates() {
    return HOOK_TEMPLATES
  },

  getEventInfo() {
    return HOOK_EVENT_INFO
  },

  getEvents() {
    return HOOK_EVENTS.map(e => ({
      value: e,
      ...HOOK_EVENT_INFO[e],
    }))
  },

  async createFromTemplate(templateId: string, userId: string) {
    const template = HOOK_TEMPLATES.find(t => t.id === templateId)
    if (!template) throw new Error(`Template "${templateId}" nao encontrado`)

    return hooksRepository.create({
      name: template.name,
      description: template.description,
      eventType: template.eventType,
      matcher: template.matcher,
      handlerType: template.handlerType,
      command: template.command ?? null,
      prompt: template.prompt ?? null,
      timeout: template.timeout,
      isAsync: template.isAsync,
      statusMessage: template.statusMessage,
      enabled: true,
      isGlobal: true,
      templateId: template.id,
    }, userId)
  },

  buildHooksConfig(hooks: Array<{
    eventType: string
    matcher: string | null
    handlerType: string
    command: string | null
    prompt: string | null
    timeout: number
    isAsync: boolean
    statusMessage: string | null
    enabled: boolean
  }>) {
    const config: Record<string, Array<{
      matcher?: string
      hooks: Array<{
        type: string
        command?: string
        prompt?: string
        timeout: number
        isAsync?: boolean
        statusMessage?: string
      }>
    }>> = {}

    const enabledHooks = hooks.filter(h => h.enabled)

    for (const hook of enabledHooks) {
      if (!config[hook.eventType]) {
        config[hook.eventType] = []
      }

      // Find or create a matcher group
      const matcherKey = hook.matcher || '__no_matcher__'
      let group = config[hook.eventType].find(g =>
        (g.matcher || '__no_matcher__') === matcherKey
      )

      if (!group) {
        group = { hooks: [] }
        if (hook.matcher) group.matcher = hook.matcher
        config[hook.eventType].push(group)
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

      group.hooks.push(hookEntry as typeof group.hooks[number])
    }

    return config
  },

  generatePreview(hooks: Array<{
    eventType: string
    matcher: string | null
    handlerType: string
    command: string | null
    prompt: string | null
    timeout: number
    isAsync: boolean
    statusMessage: string | null
    enabled: boolean
  }>) {
    const config = this.buildHooksConfig(hooks)
    return JSON.stringify({ hooks: config }, null, 2)
  },
}
