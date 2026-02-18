export interface Agent {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  tools: string[]
  disallowedTools: string[]
  model: string | null
  permissionMode: string
  maxTurns: number | null
  skills: string[]
  enabled: boolean
  isGlobal: boolean
  pluginId: string | null
  source: 'manual' | 'imported'
  repoUrl: string | null
  createdAt: string
  updatedAt?: string
}

export interface AgentInput {
  name: string
  description?: string
  systemPrompt?: string
  tools?: string[]
  disallowedTools?: string[]
  model?: string
  permissionMode?: string
  maxTurns?: number
  skills?: string[]
  enabled?: boolean
  isGlobal?: boolean
}
