export interface McpServer {
  id: string
  name: string
  description: string | null
  type: 'http' | 'sse' | 'stdio'
  uri: string | null
  command: string | null
  args?: string[]
  envVars?: Record<string, string>
  enabled: boolean
  isGlobal: boolean
  toolsCache?: McpTool[] | null
  lastTestAt: string | null
  lastTestOk: boolean | null
  pluginId: string | null
  createdAt: string
  updatedAt?: string
}

export interface McpTool {
  name: string
  description?: string
}

export interface McpServerInput {
  name: string
  description?: string
  type: 'http' | 'sse' | 'stdio'
  uri?: string
  command?: string
  args?: string[]
  envVars?: Record<string, string>
  enabled?: boolean
  isGlobal?: boolean
}

export interface McpTestResult {
  ok: boolean
  tools?: McpTool[]
  error?: string
}
