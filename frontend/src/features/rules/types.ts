export interface Rule {
  id: string
  name: string
  description: string | null
  body: string
  enabled: boolean
  isGlobal: boolean
  source: 'manual' | 'imported'
  repoUrl: string | null
  repoOwner: string | null
  repoName: string | null
  lastSyncedAt: string | null
  skillId: string | null
  skillName: string | null
  pluginId: string | null
  createdAt: string
  updatedAt?: string
}

export interface RuleInput {
  name: string
  description?: string
  body?: string
  enabled?: boolean
  isGlobal?: boolean
  skillId?: string | null
}
