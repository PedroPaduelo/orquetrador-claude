export interface Conversation {
  id: string
  title: string | null
  projectPath: string | null
  workflowId: string
  workflowName?: string
  workflowType?: 'sequential' | 'step_by_step'
  currentStepId: string | null
  currentStepName?: string | null
  currentStepIndex?: number
  messagesCount?: number
  workflow?: ConversationWorkflow
  messages?: Message[]
  createdAt: string
  updatedAt: string
}

export interface ConversationWorkflow {
  id: string
  name: string
  type: 'sequential' | 'step_by_step'
  steps: WorkflowStepSummary[]
}

export interface WorkflowStepSummary {
  id: string
  name: string
  stepOrder: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  stepId: string | null
  stepName: string | null
  selectedForContext: boolean
  metadata?: MessageMetadata
  attachments?: Attachment[]
  createdAt: string
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size?: number
  path: string
  projectPath: string
  url: string
}

export interface MessageMetadata {
  actions?: Action[]
  sessionId?: string
  stepName?: string
  stepOrder?: number
}

export interface Action {
  type: 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'stderr'
  name?: string
  input?: unknown
  output?: unknown
  content?: string
  id?: string
}

export interface CreateConversationInput {
  workflowId: string
  title?: string
  projectPath: string
}

export interface ProjectFolder {
  name: string
  path: string
  conversationsCount: number
}

export interface StreamEvent {
  event: string
  data: unknown
}
