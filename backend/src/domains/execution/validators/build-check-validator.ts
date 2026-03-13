import { execSync } from 'child_process'
import type { ValidationResult } from './types.js'

export function runBuildCheck(command: string, projectPath: string): ValidationResult {
  try {
    execSync(command, { cwd: projectPath, timeout: 120_000, stdio: 'pipe' })
    return { valid: true, validatorType: 'build_check', message: 'Build passed' }
  } catch (err) {
    const error = err as { stderr?: Buffer; stdout?: Buffer }
    const stderr = error.stderr?.toString().slice(0, 1000) || ''
    const stdout = error.stdout?.toString().slice(0, 1000) || ''
    return {
      valid: false,
      validatorType: 'build_check',
      message: 'Build failed',
      details: stderr || stdout,
    }
  }
}
