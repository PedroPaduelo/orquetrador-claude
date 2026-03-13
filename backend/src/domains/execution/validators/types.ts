export interface ValidatorConfig {
  type: 'build_check' | 'test_check' | 'json_schema' | 'llm_judge'
  command?: string
  schema?: Record<string, unknown>
  criteria?: string
  enabled?: boolean
}

export interface ValidationResult {
  valid: boolean
  validatorType: string
  type?: string
  message: string
  feedback?: string
  details?: string
}
