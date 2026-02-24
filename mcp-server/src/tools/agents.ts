import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, formatResult } from '../api-client.js'

export function registerAgentTools(server: McpServer) {
  server.tool(
    'agent_list',
    `Lista todos os agentes configurados no sistema.

RETORNA: Array de agentes com id, name, description, model, enabled, isGlobal, permissionMode.

Agentes definem personalidades/capacidades de IA que podem ser atribuidos a steps de workflows.`,
    {},
    async () => formatResult(await apiGet('/agents'))
  )

  server.tool(
    'agent_get',
    `Busca um agente especifico pelo ID com detalhes completos.

RETORNA: Agente com systemPrompt, tools permitidas/bloqueadas, skills associadas, model, permissionMode, maxTurns.`,
    { id: z.string().describe('ID do agente') },
    async ({ id }) => formatResult(await apiGet(`/agents/${id}`))
  )

  server.tool(
    'agent_create',
    `Cria um novo agente no sistema.

INPUT:
- name: Nome do agente (obrigatorio)
- description: O que este agente faz
- systemPrompt: Prompt de sistema que define personalidade e comportamento
- tools: Array de nomes de tools permitidas (ex: ["Read", "Write", "Bash"])
- disallowedTools: Array de tools bloqueadas
- model: Modelo (ex: "claude-sonnet-4-20250514", "claude-opus-4-20250514")
- permissionMode: "default", "acceptEdits" ou "fullAuto"
- maxTurns: Numero maximo de turnos por execucao
- skills: Array de IDs de skills associadas
- enabled: Se o agente esta ativo (default: true)
- isGlobal: Se aparece em todos os workflows (default: false)

EXEMPLO:
{
  "name": "Code Reviewer",
  "systemPrompt": "Voce e um revisor de codigo experiente...",
  "model": "claude-sonnet-4-20250514",
  "tools": ["Read", "Grep", "Glob"],
  "permissionMode": "default"
}`,
    {
      name: z.string().describe('Nome do agente'),
      description: z.string().optional().describe('Descricao do agente'),
      systemPrompt: z.string().optional().describe('System prompt do agente'),
      tools: z.array(z.string()).optional().describe('Tools permitidas'),
      disallowedTools: z.array(z.string()).optional().describe('Tools bloqueadas'),
      model: z.string().optional().describe('Modelo a usar'),
      permissionMode: z.string().optional().describe('Modo de permissao: default, acceptEdits, fullAuto'),
      maxTurns: z.number().optional().describe('Max turnos por execucao'),
      skills: z.array(z.string()).optional().describe('IDs de skills associadas'),
      enabled: z.boolean().optional().describe('Se esta ativo'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/agents', args))
  )

  server.tool(
    'agent_update',
    `Atualiza um agente existente. Todos os campos sao opcionais.

USE agent_get antes para ver o estado atual.`,
    {
      id: z.string().describe('ID do agente'),
      name: z.string().optional().describe('Novo nome'),
      description: z.string().optional().describe('Nova descricao'),
      systemPrompt: z.string().optional().describe('Novo system prompt'),
      tools: z.array(z.string()).optional().describe('Novas tools permitidas'),
      disallowedTools: z.array(z.string()).optional().describe('Novas tools bloqueadas'),
      model: z.string().optional().describe('Novo modelo'),
      permissionMode: z.string().optional().describe('Novo modo de permissao'),
      maxTurns: z.number().optional().describe('Novo max turnos'),
      skills: z.array(z.string()).optional().describe('Novos IDs de skills'),
      enabled: z.boolean().optional().describe('Ativar/desativar'),
      isGlobal: z.boolean().optional().describe('Tornar global ou nao'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/agents/${id}`, body))
  )

  server.tool(
    'agent_delete',
    `Deleta um agente permanentemente.`,
    { id: z.string().describe('ID do agente a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/agents/${id}`))
  )

  server.tool(
    'agent_toggle',
    `Ativa ou desativa um agente (toggle).`,
    { id: z.string().describe('ID do agente') },
    async ({ id }) => formatResult(await apiPatch(`/agents/${id}/toggle`))
  )

  server.tool(
    'agent_import',
    `Importa um agente a partir de uma URL do GitHub ou conteudo markdown direto.

INPUT (pelo menos um obrigatorio):
- url: URL do GitHub (raw ou blob)
- content: Conteudo markdown direto
- isGlobal: Se deve ser global`,
    {
      url: z.string().optional().describe('URL do GitHub'),
      content: z.string().optional().describe('Conteudo markdown'),
      isGlobal: z.boolean().optional().describe('Se e global'),
    },
    async (args) => formatResult(await apiPost('/agents/import', args))
  )
}
