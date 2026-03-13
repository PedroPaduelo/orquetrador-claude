import type { ValidatorConfig } from '@/features/workflows/types'

export interface StepTemplate {
  id: string
  name: string
  description: string | null
  baseUrl: string
  systemPrompt?: string
  maxRetries: number
  backend?: string
  validators?: ValidatorConfig[]
  inputVariables?: string[]
  outputVariables?: string[]
  mcpServerIds: string[]
  skillIds: string[]
  agentIds: string[]
  ruleIds: string[]
  hookIds: string[]
  createdAt: string
  updatedAt: string
}

export interface StepTemplateInput {
  name: string
  description?: string
  baseUrl: string
  systemPrompt?: string
  maxRetries?: number
  backend?: string
  validators?: ValidatorConfig[]
  inputVariables?: string[]
  outputVariables?: string[]
  mcpServerIds?: string[]
  skillIds?: string[]
  agentIds?: string[]
  ruleIds?: string[]
  hookIds?: string[]
}
