import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerHookTools(server: McpServer) {
  server.tool(
    'hook_list',
    `Lista todos os hooks do sistema.

RETORNA: Array de hooks com id, name, description, eventType, matcher, handlerType, command, prompt, timeout, isAsync, enabled.

Hooks sao automacoes que executam no ciclo de vida do Claude Code (antes/depois de ferramentas, inicio/fim de sessao, etc).

Os 16 eventos disponiveis sao:
- FERRAMENTAS: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest
- CICLO DE VIDA: Stop, UserPromptSubmit, Notification, SessionStart, SessionEnd
- WORKFLOW: SubagentStart, SubagentStop, TeammateIdle, TaskCompleted
- SISTEMA: PreCompact, WorktreeCreate, WorktreeRemove`,
    {},
    async () => formatResult(await apiGet('/hooks'))
  )

  server.tool(
    'hook_get',
    `Busca um hook especifico pelo ID com todos os detalhes.`,
    { id: z.string().describe('ID do hook') },
    async ({ id }) => formatResult(await apiGet(`/hooks/${id}`))
  )

  server.tool(
    'hook_create',
    `Cria um novo hook no sistema.

INPUT:
- name: Nome do hook (obrigatorio)
- description: Descricao do proposito
- eventType: Evento que dispara o hook (ex: PreToolUse, PostToolUse, Stop)
- matcher: Regex para filtrar (ex: "Bash" para PreToolUse, "Write|Edit" para PostToolUse)
- handlerType: "command" (shell), "prompt" (LLM decide), "agent" (subagente)
- command: Comando shell (para handlerType=command)
- prompt: Texto do prompt (para handlerType=prompt ou agent)
- timeout: Timeout em ms (default: 60000)
- isAsync: Se executa sem bloquear (default: false)
- statusMessage: Mensagem exibida durante execucao
- enabled: Se esta ativo (default: true)
- isGlobal: Se aplica a todos os projetos (default: true)

EXEMPLO:
{
  "name": "Bloquear rm -rf",
  "eventType": "PreToolUse",
  "matcher": "Bash",
  "handlerType": "command",
  "command": "if echo \\"$TOOL_INPUT\\" | grep -qE \\"rm -rf\\"; then exit 2; fi",
  "timeout": 5000
}`,
    {
      name: z.string().describe('Nome do hook'),
      description: z.string().optional().describe('Descricao'),
      eventType: z.string().describe('Evento: PreToolUse, PostToolUse, Stop, UserPromptSubmit, etc.'),
      matcher: z.string().optional().describe('Regex matcher (ex: Bash, Write|Edit)'),
      handlerType: z.enum(['command', 'prompt', 'agent']).optional().describe('Tipo: command, prompt ou agent'),
      command: z.string().optional().describe('Comando shell (para command handler)'),
      prompt: z.string().optional().describe('Prompt texto (para prompt/agent handler)'),
      timeout: z.number().optional().describe('Timeout em ms (default: 60000)'),
      isAsync: z.boolean().optional().describe('Executar sem bloquear'),
      statusMessage: z.string().optional().describe('Mensagem durante execucao'),
      enabled: z.boolean().optional().describe('Se esta ativo'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/hooks', args))
  )

  server.tool(
    'hook_update',
    `Atualiza um hook existente. Todos os campos sao opcionais.`,
    {
      id: z.string().describe('ID do hook'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      eventType: z.string().optional().describe('Novo evento'),
      matcher: z.string().optional().describe('Novo matcher regex'),
      handlerType: z.enum(['command', 'prompt', 'agent']).optional().describe('Novo tipo'),
      command: z.string().optional().describe('Novo comando'),
      prompt: z.string().optional().describe('Novo prompt'),
      timeout: z.number().optional().describe('Novo timeout'),
      isAsync: z.boolean().optional().describe('Novo isAsync'),
      statusMessage: z.string().optional().describe('Nova mensagem'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      isGlobal: z.boolean().optional().describe('Tornar global ou nao'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/hooks/${id}`, body))
  )

  server.tool(
    'hook_delete',
    `Deleta um hook permanentemente.`,
    { id: z.string().describe('ID do hook a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/hooks/${id}`))
  )

  server.tool(
    'hook_toggle',
    `Ativa ou desativa um hook (toggle).`,
    { id: z.string().describe('ID do hook') },
    async ({ id }) => formatResult(await apiPatch(`/hooks/${id}/toggle`))
  )

  server.tool(
    'hook_templates',
    `Lista os templates de hooks pre-configurados disponiveis.

Templates prontos incluem: Bloquear rm-rf, Auto Lint, Auto Format, Log Operacoes, Bloquear Secrets, Auto Test, Git Auto Stage, Revisar Mudancas.

USE para ver opcoes rapidas antes de criar hooks do zero.`,
    {},
    async () => formatResult(await apiGet('/hooks/templates'))
  )

  server.tool(
    'hook_create_from_template',
    `Cria um hook a partir de um template pre-configurado.

IDs de templates disponiveis: block-rm-rf, auto-lint, auto-format, log-operations, block-secrets, auto-test, git-auto-stage, review-prompt

USE hook_templates primeiro para ver os detalhes de cada template.`,
    { templateId: z.string().describe('ID do template (ex: block-rm-rf, auto-lint, auto-format)') },
    async (args) => formatResult(await apiPost('/hooks/from-template', args))
  )

  server.tool(
    'hook_events',
    `Lista todos os 16 eventos de hooks do Claude Code com metadados.

RETORNA: Para cada evento: value, label, description, supportsMatcher, matcherLabel, matcherHint, category.

USE para entender quais eventos existem e como configurar matchers.`,
    {},
    async () => formatResult(await apiGet('/hooks/events'))
  )

  server.tool(
    'hook_preview',
    `Gera o JSON de configuracao de hooks para .claude/settings.json.

Retorna o JSON pronto para colar no arquivo de settings do Claude Code.
Opcionalmente filtra por IDs especificos de hooks.

USE para exportar a configuracao de hooks em formato Claude Code.`,
    {
      hookIds: z.array(z.string()).optional().describe('IDs dos hooks a incluir (vazio = todos ativos)'),
    },
    async (args) => formatResult(await apiPost('/hooks/preview', args))
  )
}
