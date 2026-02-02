export interface ConditionRule {
  type: 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'length_gt' | 'length_lt'
  match: string
  goto: string
  maxRetries?: number
  retryMessage?: string
}

export interface StepConditions {
  rules: ConditionRule[]
  default: string
}

export interface ConditionResult {
  matched: boolean
  action: string
  rule?: ConditionRule
}

export class ConditionsEvaluator {
  evaluate(content: string, conditions: StepConditions): ConditionResult {
    if (!conditions || !conditions.rules || conditions.rules.length === 0) {
      return {
        matched: false,
        action: conditions?.default || 'next',
      }
    }

    for (const rule of conditions.rules) {
      if (this.matchesRule(content, rule)) {
        return {
          matched: true,
          action: rule.goto,
          rule,
        }
      }
    }

    return {
      matched: false,
      action: conditions.default || 'next',
    }
  }

  private matchesRule(content: string, rule: ConditionRule): boolean {
    const normalizedContent = content.toLowerCase()
    const normalizedMatch = rule.match.toLowerCase()

    switch (rule.type) {
      case 'contains':
        return normalizedContent.includes(normalizedMatch)

      case 'not_contains':
        return !normalizedContent.includes(normalizedMatch)

      case 'equals':
        return normalizedContent.trim() === normalizedMatch.trim()

      case 'starts_with':
        return normalizedContent.startsWith(normalizedMatch)

      case 'ends_with':
        return normalizedContent.endsWith(normalizedMatch)

      case 'regex':
        try {
          const regex = new RegExp(rule.match, 'i')
          return regex.test(content)
        } catch {
          console.error(`Invalid regex pattern: ${rule.match}`)
          return false
        }

      case 'length_gt':
        return content.length > parseInt(rule.match, 10)

      case 'length_lt':
        return content.length < parseInt(rule.match, 10)

      default:
        return false
    }
  }

  resolveNextStep(
    action: string,
    steps: Array<{ id: string; name: string }>,
    currentIndex: number
  ): { nextIndex: number; isRetry: boolean; isFinished: boolean } {
    switch (action) {
      case 'next':
        return {
          nextIndex: currentIndex + 1,
          isRetry: false,
          isFinished: currentIndex + 1 >= steps.length,
        }

      case 'previous':
        return {
          nextIndex: Math.max(0, currentIndex - 1),
          isRetry: false,
          isFinished: false,
        }

      case 'retry':
        return {
          nextIndex: currentIndex,
          isRetry: true,
          isFinished: false,
        }

      case 'finish':
        return {
          nextIndex: steps.length,
          isRetry: false,
          isFinished: true,
        }

      default:
        // Try to find step by ID or index
        const stepIndex = steps.findIndex((s) => s.id === action)
        if (stepIndex !== -1) {
          return {
            nextIndex: stepIndex,
            isRetry: false,
            isFinished: false,
          }
        }

        // Try as numeric index
        const numericIndex = parseInt(action, 10)
        if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < steps.length) {
          return {
            nextIndex: numericIndex,
            isRetry: false,
            isFinished: false,
          }
        }

        // Default to next
        return {
          nextIndex: currentIndex + 1,
          isRetry: false,
          isFinished: currentIndex + 1 >= steps.length,
        }
    }
  }

  formatRetryMessage(template: string | undefined, output: string, rule: ConditionRule): string {
    if (!template) {
      return `A saida anterior nao atendeu aos criterios. Por favor, tente novamente.`
    }

    return template
      .replace('{output}', output)
      .replace('{error}', rule.match)
      .replace('{type}', rule.type)
  }
}

export const conditionsEvaluator = new ConditionsEvaluator()
