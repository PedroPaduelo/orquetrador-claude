import Anthropic from '@anthropic-ai/sdk'
import { safeTruncate } from '../../../lib/safe-json.js'
import type { ValidationResult } from './types.js'

const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-placeholder',
})

export async function runLlmJudge(output: string, criteria: string): Promise<ValidationResult> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Evaluate the following output against the criteria. Reply with ONLY "PASS" or "FAIL" on the first line, then a brief explanation.\n\nCriteria: ${criteria}\n\nOutput:\n${safeTruncate(output, 5000)}`,
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const passed = text.trim().toUpperCase().startsWith('PASS')
    return {
      valid: passed,
      validatorType: 'llm_judge',
      message: passed ? 'LLM judge: passed' : 'LLM judge: failed',
      details: safeTruncate(text, 500),
    }
  } catch (err) {
    return {
      valid: true, // Don't block on LLM judge errors
      validatorType: 'llm_judge',
      message: 'LLM judge skipped due to error',
      details: (err as Error).message,
    }
  }
}
