/**
 * Base System Prompt - Compositor
 *
 * Este prompt é injetado em TODOS os steps, independente do workflow ou usuario.
 * Contem diretrizes gerais do ambiente de trabalho.
 *
 * Cada seção está em seu próprio arquivo em ./prompt-sections/.
 * Para editar uma seção específica, modifique o arquivo correspondente.
 */

import {
  getIdentitySection,
  getCommunicationSection,
  getInfrastructureSection,
  getDatabaseSection,
  getStackSection,
  getSecuritySection,
  getGitSection,
  getTestingSection,
  getDocumentationSection,
  getArchitectureSection,
  getFinalizationSection,
} from './prompt-sections/index.js'

function getBaseSystemPrompt(projectPath: string): string {
  return [
    getIdentitySection(projectPath),
    getCommunicationSection(),
    getInfrastructureSection(),
    getDatabaseSection(),
    getStackSection(),
    getSecuritySection(projectPath),
    getGitSection(),
    getTestingSection(),
    getDocumentationSection(),
    getArchitectureSection(),
    getFinalizationSection(),
  ].join('\n\n')
}

export interface BuildSystemPromptOptions {
  stepSystemPrompt?: string | null
  projectPath: string
  memory?: string | null
  useBasePrompt?: boolean
}

/**
 * Monta o system prompt final combinando o prompt base (hard) com o prompt do step.
 *
 * - Se o step tem systemPrompt: base + separador + step prompt
 * - Se o step NAO tem systemPrompt: apenas o base
 * - Se tem memória: injeta a memória como contexto acumulado
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const useBase = options.useBasePrompt !== false

  const parts: string[] = []

  if (useBase) {
    parts.push(getBaseSystemPrompt(options.projectPath))
  }

  if (options.stepSystemPrompt && options.stepSystemPrompt.trim().length > 0) {
    parts.push(options.stepSystemPrompt.trim())
  }

  if (options.memory && options.memory.trim().length > 0) {
    parts.push(`## MEMÓRIA DE CONTEXTO (Sessões Anteriores)

A sessão anterior foi compactada. Abaixo está o resumo acumulado do que aconteceu até agora neste step. Use este contexto para manter continuidade no trabalho.

${options.memory.trim()}

---
IMPORTANTE: Continue o trabalho de onde parou, usando a memória acima como referência. Não repita trabalho já feito. Se o usuário pedir algo que já foi feito (de acordo com a memória), informe que já está pronto.`)
  }

  return parts.join('\n\n---\n\n')
}
