import type { ValidationResult } from './types.js'

export function runJsonSchemaCheck(output: string, schema: Record<string, unknown>): ValidationResult {
  try {
    const parsed = JSON.parse(output)
    // Basic type checking based on schema
    const requiredFields = (schema.required || []) as string[]
    const missing = requiredFields.filter(f => !(f in parsed))
    if (missing.length > 0) {
      return {
        valid: false,
        validatorType: 'json_schema',
        message: `Missing required fields: ${missing.join(', ')}`,
      }
    }
    return { valid: true, validatorType: 'json_schema', message: 'JSON schema valid' }
  } catch {
    return {
      valid: false,
      validatorType: 'json_schema',
      message: 'Output is not valid JSON',
    }
  }
}
