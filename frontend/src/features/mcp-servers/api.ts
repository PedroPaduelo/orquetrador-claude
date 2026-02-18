import { apiClient } from '@/shared/lib/api-client'
import type { McpServer, McpServerInput, McpTestResult } from './types'

export const mcpServersApi = {
  list: async (): Promise<McpServer[]> => {
    const { data } = await apiClient.get('/mcp-servers')
    return data
  },

  get: async (id: string): Promise<McpServer> => {
    const { data } = await apiClient.get(`/mcp-servers/${id}`)
    return data
  },

  create: async (input: McpServerInput): Promise<McpServer> => {
    const { data } = await apiClient.post('/mcp-servers', input)
    return data
  },

  update: async (id: string, input: Partial<McpServerInput>): Promise<McpServer> => {
    const { data } = await apiClient.put(`/mcp-servers/${id}`, input)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/mcp-servers/${id}`)
  },

  test: async (id: string): Promise<McpTestResult> => {
    const { data } = await apiClient.post(`/mcp-servers/${id}/test`)
    return data
  },

  toggle: async (id: string): Promise<{ id: string; enabled: boolean }> => {
    const { data } = await apiClient.patch(`/mcp-servers/${id}/toggle`)
    return data
  },

  quickInstall: async (input: { command: string; name?: string; description?: string; envVars?: Record<string, string>; isGlobal?: boolean }): Promise<McpServer> => {
    const { data } = await apiClient.post('/mcp-servers/quick-install', input)
    return data
  },
}
