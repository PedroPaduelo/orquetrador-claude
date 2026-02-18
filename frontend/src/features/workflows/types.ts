export interface Workflow {
  id: string
  name: string
  description: string | null
  type: 'sequential' | 'step_by_step'
  projectPath: string | null
  steps?: WorkflowStep[]
  stepsCount?: number
  conversationsCount?: number
  createdAt: string
  updatedAt: string
}

export interface WorkflowStep {
  id?: string
  name: string
  baseUrl: string
  stepOrder?: number
  systemPrompt?: string
  systemPromptNoteId?: string
  contextNoteIds: string[]
  memoryNoteIds: string[]
  conditions: StepConditions
  maxRetries: number
  mcpServerIds: string[]
  skillIds: string[]
  agentIds: string[]
}

export interface StepConditions {
  rules: ConditionRule[]
  default: string
}

export interface ConditionRule {
  type: 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'length_gt' | 'length_lt'
  match: string
  goto: string
  maxRetries?: number
  retryMessage?: string
}

export interface WorkflowInput {
  name: string
  description?: string
  type: 'sequential' | 'step_by_step'
  projectPath?: string
  steps: Omit<WorkflowStep, 'id' | 'stepOrder'>[]
}
