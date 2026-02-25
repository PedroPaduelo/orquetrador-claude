export interface Hook {
  id: string
  name: string
  description: string | null
  eventType: string
  matcher: string | null
  handlerType: 'command' | 'prompt' | 'agent'
  command: string | null
  prompt: string | null
  timeout: number
  isAsync: boolean
  statusMessage: string | null
  enabled: boolean
  isGlobal: boolean
  projectPath: string | null
  isTemplate: boolean
  templateId: string | null
  createdAt: string
  updatedAt: string
}

export interface HookInput {
  name: string
  description?: string
  eventType: string
  matcher?: string | null
  handlerType?: 'command' | 'prompt' | 'agent'
  command?: string | null
  prompt?: string | null
  timeout?: number
  isAsync?: boolean
  statusMessage?: string | null
  enabled?: boolean
  isGlobal?: boolean
  projectPath?: string | null
  templateId?: string | null
}

export interface HookTemplate {
  id: string
  name: string
  description: string
  eventType: string
  matcher: string | null
  handlerType: string
  command: string | null
  prompt: string | null
  timeout: number
  isAsync: boolean
  statusMessage: string | null
}

export interface HookEventInfo {
  value: string
  label: string
  description: string
  supportsMatcher: boolean
  matcherLabel?: string
  matcherHint?: string
  category: 'tools' | 'lifecycle' | 'workflow' | 'system'
}
