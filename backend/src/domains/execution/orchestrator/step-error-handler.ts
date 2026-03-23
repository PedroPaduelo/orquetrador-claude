import type { WorkflowStep } from '@prisma/client'
import type { EngineExecuteResult } from '../engine/types.js'

export type ErrorHandlerAction = 'fail' | 'skip' | 'continue_next' | 'fallback'

export interface StepErrorDecision {
  action: ErrorHandlerAction
  skipStep: boolean
  continueAsSuccess: boolean
  shouldRetryWithFallback: boolean
  logMessage: string
}

const DEFAULT_TIMEOUT_MS = 300000 // 5 min

export function getStepTimeout(step: WorkflowStep): number {
  return (step.timeout as number | null) ?? DEFAULT_TIMEOUT_MS
}

export function isStepError(result: EngineExecuteResult): boolean {
  return !!(result.error || result.timedOut)
}

export function getErrorMessage(result: EngineExecuteResult): string {
  if (result.timedOut) return 'Step timed out'
  return result.error || 'Unknown error'
}

export function resolveErrorHandler(step: WorkflowStep): ErrorHandlerAction {
  const handler = (step as Record<string, unknown>).errorHandler as string | undefined
  if (handler === 'skip' || handler === 'continue_next' || handler === 'fallback') {
    return handler
  }
  return 'fail'
}

export function decideOnError(step: WorkflowStep, result: EngineExecuteResult): StepErrorDecision {
  const errorMsg = getErrorMessage(result)
  const handler = resolveErrorHandler(step)

  switch (handler) {
    case 'skip':
      return {
        action: 'skip',
        skipStep: true,
        continueAsSuccess: false,
        shouldRetryWithFallback: false,
        logMessage: `[ErrorHandler:skip] Step "${step.name}" falhou (${errorMsg}). Pulando para o proximo.`,
      }

    case 'continue_next':
      return {
        action: 'continue_next',
        skipStep: false,
        continueAsSuccess: true,
        shouldRetryWithFallback: false,
        logMessage: `[ErrorHandler:continue_next] Step "${step.name}" falhou (${errorMsg}). Continuando como se tivesse sucesso.`,
      }

    case 'fallback':
      return {
        action: 'fallback',
        skipStep: false,
        continueAsSuccess: false,
        shouldRetryWithFallback: true,
        logMessage: `[ErrorHandler:fallback] Step "${step.name}" falhou (${errorMsg}). Tentando fallback com prompt simplificado.`,
      }

    case 'fail':
    default:
      return {
        action: 'fail',
        skipStep: false,
        continueAsSuccess: false,
        shouldRetryWithFallback: false,
        logMessage: `[ErrorHandler:fail] Step "${step.name}" falhou (${errorMsg}). Parando execucao.`,
      }
  }
}

export const FALLBACK_MESSAGE = 'Retry: a execucao anterior falhou. Tente novamente de forma mais simples.'
