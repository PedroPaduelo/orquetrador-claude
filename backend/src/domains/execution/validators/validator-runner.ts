import type { ValidatorConfig, ValidationResult } from './types.js'
import { runBuildCheck } from './build-check-validator.js'
import { runTestCheck } from './test-check-validator.js'
import { runJsonSchemaCheck } from './json-schema-validator.js'
import { runLlmJudge } from './llm-judge-validator.js'

export async function runValidators(
  validators: ValidatorConfig[],
  output: string,
  projectPath: string
): Promise<{ allPassed: boolean; results: ValidationResult[] }> {
  const results: ValidationResult[] = []

  for (const validator of validators) {
    if (validator.enabled === false) continue

    let result: ValidationResult

    switch (validator.type) {
      case 'build_check':
        result = runBuildCheck(validator.command || 'npm run build', projectPath)
        break
      case 'test_check':
        result = runTestCheck(validator.command || 'npm test', projectPath)
        break
      case 'json_schema':
        result = runJsonSchemaCheck(output, validator.schema || {})
        break
      case 'llm_judge':
        result = await runLlmJudge(output, validator.criteria || 'Is the output high quality?')
        break
      default:
        continue
    }

    results.push(result)

    // Fail-fast: stop on first failure
    if (!result.valid) {
      return { allPassed: false, results }
    }
  }

  return { allPassed: true, results }
}
