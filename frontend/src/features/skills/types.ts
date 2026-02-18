export interface Skill {
  id: string
  name: string
  description: string | null
  body: string
  allowedTools: string[]
  model: string | null
  enabled: boolean
  isGlobal: boolean
  pluginId: string | null
  createdAt: string
  updatedAt?: string
}

export interface SkillInput {
  name: string
  description?: string
  body?: string
  allowedTools?: string[]
  model?: string
  enabled?: boolean
  isGlobal?: boolean
}
