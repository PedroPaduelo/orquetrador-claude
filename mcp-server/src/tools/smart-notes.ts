import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, formatResult } from '../api-client.js'

export function registerSmartNoteTools(server: McpServer) {
  server.tool(
    'smart_notes_status',
    `Verifica o status de conexao com o servico Smart Notes.

RETORNA: { configured, connected }`,
    {},
    async () => formatResult(await apiGet('/smart-notes/status'))
  )

  server.tool(
    'smart_notes_folders_list',
    `Lista as pastas do Smart Notes.`,
    {},
    async () => formatResult(await apiGet('/smart-notes/folders'))
  )

  server.tool(
    'smart_notes_folder_create',
    `Cria uma nova pasta no Smart Notes.`,
    {
      name: z.string().describe('Nome da pasta'),
      icon: z.string().optional().describe('Icone da pasta'),
      color: z.string().optional().describe('Cor da pasta'),
      parentId: z.string().optional().describe('ID da pasta pai'),
    },
    async (args) => formatResult(await apiPost('/smart-notes/folders', args))
  )

  server.tool(
    'smart_notes_folder_update',
    `Atualiza uma pasta do Smart Notes.`,
    {
      id: z.string().describe('ID da pasta'),
      name: z.string().optional().describe('Novo nome'),
      icon: z.string().optional().describe('Novo icone'),
      color: z.string().optional().describe('Nova cor'),
      parentId: z.string().optional().describe('Novo parent ID'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/smart-notes/folders/${id}`, body))
  )

  server.tool(
    'smart_notes_folder_delete',
    `Deleta uma pasta do Smart Notes.`,
    { id: z.string().describe('ID da pasta a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/smart-notes/folders/${id}`))
  )

  server.tool(
    'smart_notes_search',
    `Pesquisa notas por texto.

RETORNA: Array de notas que correspondem a busca.`,
    { query: z.string().describe('Texto de busca') },
    async ({ query }) => formatResult(await apiGet(`/smart-notes/notes/search?q=${encodeURIComponent(query)}`))
  )

  server.tool(
    'smart_notes_list',
    `Lista notas do Smart Notes com filtro opcional por pasta.`,
    {
      folderId: z.string().optional().describe('Filtrar por pasta ID'),
    },
    async ({ folderId }) => {
      const query = folderId ? `?folderId=${folderId}` : ''
      return formatResult(await apiGet(`/smart-notes/notes${query}`))
    }
  )

  server.tool(
    'smart_notes_get',
    `Busca uma nota especifica pelo ID com conteudo completo.`,
    { id: z.string().describe('ID da nota') },
    async ({ id }) => formatResult(await apiGet(`/smart-notes/notes/${id}`))
  )

  server.tool(
    'smart_notes_create',
    `Cria uma nova nota no Smart Notes.

INPUT:
- title: Titulo da nota (obrigatorio)
- content: Conteudo da nota
- contentType: Tipo do conteudo (ex: "markdown")
- folderId: Pasta destino
- tags: Array de tags
- isPinned: Se e fixada`,
    {
      title: z.string().describe('Titulo da nota'),
      content: z.string().optional().describe('Conteudo da nota'),
      contentType: z.string().optional().describe('Tipo do conteudo'),
      folderId: z.string().optional().describe('ID da pasta'),
      tags: z.array(z.string()).optional().describe('Tags'),
      isPinned: z.boolean().optional().describe('Se e fixada'),
    },
    async (args) => formatResult(await apiPost('/smart-notes/notes', args))
  )

  server.tool(
    'smart_notes_update',
    `Atualiza uma nota existente.`,
    {
      id: z.string().describe('ID da nota'),
      title: z.string().optional().describe('Novo titulo'),
      content: z.string().optional().describe('Novo conteudo'),
      tags: z.array(z.string()).optional().describe('Novas tags'),
    },
    async ({ id, ...body }) => formatResult(await apiPut(`/smart-notes/notes/${id}`, body))
  )

  server.tool(
    'smart_notes_delete',
    `Deleta uma nota.`,
    { id: z.string().describe('ID da nota a deletar') },
    async ({ id }) => formatResult(await apiDelete(`/smart-notes/notes/${id}`))
  )

  server.tool(
    'smart_notes_move',
    `Move uma nota para outra pasta.`,
    {
      id: z.string().describe('ID da nota'),
      folderId: z.string().nullable().describe('ID da pasta destino (null para raiz)'),
    },
    async ({ id, folderId }) => formatResult(await apiPost(`/smart-notes/notes/${id}/move`, { folderId }))
  )

  server.tool(
    'smart_notes_archive',
    `Arquiva uma nota.`,
    { id: z.string().describe('ID da nota') },
    async ({ id }) => formatResult(await apiPost(`/smart-notes/notes/${id}/archive`))
  )

  server.tool(
    'smart_notes_unarchive',
    `Desarquiva uma nota.`,
    { id: z.string().describe('ID da nota') },
    async ({ id }) => formatResult(await apiPost(`/smart-notes/notes/${id}/unarchive`))
  )

  server.tool(
    'smart_notes_pin',
    `Fixa uma nota.`,
    { id: z.string().describe('ID da nota') },
    async ({ id }) => formatResult(await apiPost(`/smart-notes/notes/${id}/pin`))
  )

  server.tool(
    'smart_notes_unpin',
    `Desfixa uma nota.`,
    { id: z.string().describe('ID da nota') },
    async ({ id }) => formatResult(await apiPost(`/smart-notes/notes/${id}/unpin`))
  )

  server.tool(
    'smart_notes_add_tag',
    `Adiciona uma tag a uma nota.`,
    {
      id: z.string().describe('ID da nota'),
      tagName: z.string().describe('Nome da tag'),
    },
    async ({ id, tagName }) => formatResult(await apiPost(`/smart-notes/notes/${id}/tags`, { tagName }))
  )

  server.tool(
    'smart_notes_remove_tag',
    `Remove uma tag de uma nota.`,
    {
      id: z.string().describe('ID da nota'),
      tagName: z.string().describe('Nome da tag a remover'),
    },
    async ({ id, tagName }) => formatResult(await apiDelete(`/smart-notes/notes/${id}/tags/${encodeURIComponent(tagName)}`))
  )

  server.tool(
    'smart_notes_preview_context',
    `Previsualiza o contexto combinado de notas para uso em steps de workflow.

INPUT:
- systemPromptNoteId: ID da nota para system prompt
- contextNoteIds: IDs de notas para contexto
- memoryNoteIds: IDs de notas para memoria

RETORNA: { preview } com o texto combinado.

USE para verificar como as notas serao combinadas antes de configurar um step.`,
    {
      systemPromptNoteId: z.string().optional().describe('ID da nota para system prompt'),
      contextNoteIds: z.array(z.string()).optional().describe('IDs de notas para contexto'),
      memoryNoteIds: z.array(z.string()).optional().describe('IDs de notas para memoria'),
    },
    async (args) => formatResult(await apiPost('/smart-notes/preview-context', args))
  )
}
