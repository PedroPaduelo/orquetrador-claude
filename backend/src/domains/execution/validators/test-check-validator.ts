import { execSync } from 'child_process'
import type { ValidationResult } from './types.js'

export function runTestCheck(command: string, projectPath: string): ValidationResult {
  try {
    execSync(command, { cwd: projectPath, timeout: 300_000, stdio: 'pipe' })
    return { valid: true, validatorType: 'test_check', message: 'Tests passed' }
  } catch (err) {
    const error = err as { stderr?: Buffer; stdout?: Buffer }
    const output = error.stderr?.toString().slice(0, 1000) || error.stdout?.toString().slice(0, 1000) || ''
    return {
      valid: false,
      validatorType: 'test_check',
      message: 'Tests failed',
      details: output,
    }
  }
}
