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
  source: 'manual' | 'imported'
  repoUrl: string | null
  repoOwner: string | null
  repoName: string | null
  repoBranch: string | null
  repoPath: string | null
  lastSyncedAt: string | null
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
