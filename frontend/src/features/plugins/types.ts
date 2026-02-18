export interface Plugin {
  id: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  enabled: boolean
  source?: 'manual' | 'imported'
  repoUrl?: string | null
  projectPath?: string | null
  mcpServersCount: number
  skillsCount: number
  agentsCount: number
  mcpServers?: Array<{ id: string; name: string; type: string; enabled: boolean }>
  skills?: Array<{ id: string; name: string; description: string | null; enabled: boolean }>
  agents?: Array<{ id: string; name: string; description: string | null; enabled: boolean }>
  createdAt: string
  updatedAt?: string
}

export interface PluginManifest {
  mcpServers?: Array<{ name: string; description?: string; type?: string; uri?: string; command?: string; args?: string[]; envVars?: Record<string, string> }>
  skills?: Array<{ name: string; description?: string; body?: string; allowedTools?: string[]; model?: string }>
  agents?: Array<{ name: string; description?: string; systemPrompt?: string; tools?: string[]; disallowedTools?: string[]; model?: string; permissionMode?: string; maxTurns?: number; skills?: string[] }>
}

export interface PluginInput {
  name: string
  description?: string
  version?: string
  author?: string
  manifest: PluginManifest
}
