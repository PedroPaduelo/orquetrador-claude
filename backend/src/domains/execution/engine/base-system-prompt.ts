/**
 * Base System Prompt - Compositor
 *
 * Este prompt é injetado em TODOS os steps, independente do workflow ou usuario.
 * Contem diretrizes gerais do ambiente de trabalho.
 *
 * Cada seção está em seu próprio arquivo em ./prompt-sections/.
 * Para editar uma seção específica, modifique o arquivo correspondente.
 *
 * ## Prompt Caching
 *
 * O Anthropic API suporta cache de prefixo no system prompt. Para maximizar
 * cache hits, a estrutura do prompt é:
 *
 *   [CACHE_BLOCK_START]
 *   ... base prompt (identico para todos os steps) ...
 *   [CACHE_BLOCK_END]
 *   ---
 *   ... step prompt (varia por step) ...
 *   ---
 *   ... memory (varia por sessao) ...
 *
 * Os marcadores de cache delimitam o bloco estático do prompt. Como o cache
 * do Anthropic funciona por prefixo, manter o base prompt idêntico e no início
 * garante que o prefixo seja sempre o mesmo, maximizando cache hits.
 *
 * A flag PROMPT_CACHE_ENABLED (env var) controla se os marcadores são inseridos.
 * Default: true.
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

/**
 * Marcadores de cache para delimitar blocos estáticos do system prompt.
 *
 * Estes marcadores servem para:
 * 1. Sinalizar ao Anthropic API os limites do bloco cacheável
 * 2. Separar visualmente as seções do prompt para debugging
 * 3. Permitir que ferramentas de análise identifiquem os blocos de cache
 *
 * O Claude API faz cache por prefixo: se o início do system prompt for idêntico
 * entre chamadas, os tokens do prefixo são reutilizados (menor custo e latência).
 */
export const CACHE_BREAKPOINT = '<!-- cache-breakpoint -->'
export const CACHE_BLOCK_START = '<!-- cache-block:base-prompt:start -->'
export const CACHE_BLOCK_END = '<!-- cache-block:base-prompt:end -->'
export const CACHE_SECTION_BREAK = '<!-- cache-section-break -->'

/**
 * Configuração global de prompt caching.
 * Lê do env var PROMPT_CACHE_ENABLED; default é true.
 */
export const PROMPT_CACHE_ENABLED = process.env.PROMPT_CACHE_ENABLED !== 'false'

/**
 * Cache interno para o base prompt por projectPath.
 *
 * Como o base prompt só varia pelo projectPath (usado em identity e security),
 * podemos cachear a string montada em memória para evitar reconstrução
 * repetida das 11 seções a cada chamada.
 */
const basePromptCache = new Map<string, string>()

/**
 * Limpa o cache de base prompts. Útil para testes ou hot-reload.
 */
export function clearBasePromptCache(): void {
  basePromptCache.clear()
}

/**
 * Monta o base system prompt com as 11 seções.
 *
 * Quando prompt caching está habilitado, insere marcadores de cache entre
 * as seções para delimitar o bloco estático. As seções são agrupadas em
 * 3 blocos lógicos com cache breakpoints entre eles:
 *
 *   Bloco 1 (Identidade + Comunicação): Seções que definem quem é o agente
 *   Bloco 2 (Infraestrutura + DB + Stack + Segurança): Contexto técnico do ambiente
 *   Bloco 3 (Git + Testes + Docs + Arquitetura + Finalização): Processos e regras
 *
 * Os breakpoints entre blocos indicam ao API pontos ideais para truncar o cache
 * se necessário, sem quebrar contexto semântico.
 */
function getBaseSystemPrompt(projectPath: string): string {
  // Check in-memory cache first
  const cached = basePromptCache.get(projectPath)
  if (cached) return cached

  const sections = [
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
  ]

  let result: string

  if (PROMPT_CACHE_ENABLED) {
    // Com cache habilitado, estruturamos o prompt com marcadores e breakpoints.
    // Os 3 blocos lógicos são separados por cache breakpoints para que o API
    // possa reutilizar o máximo de prefixo possível.
    const block1 = [sections[0], sections[1]].join('\n\n')                                    // Identity + Communication
    const block2 = [sections[2], sections[3], sections[4], sections[5]].join('\n\n')           // Infra + DB + Stack + Security
    const block3 = [sections[6], sections[7], sections[8], sections[9], sections[10]].join('\n\n') // Git + Testing + Docs + Arch + Finalization

    result = [
      CACHE_BLOCK_START,
      '',
      block1,
      '',
      CACHE_SECTION_BREAK,
      '',
      block2,
      '',
      CACHE_BREAKPOINT,
      '',
      block3,
      '',
      CACHE_BLOCK_END,
    ].join('\n')
  } else {
    // Sem cache, monta o prompt simples como antes
    result = sections.join('\n\n')
  }

  // Cache in memory (base prompt is deterministic per projectPath)
  basePromptCache.set(projectPath, result)

  return result
}

export interface BuildSystemPromptOptions {
  stepSystemPrompt?: string | null
  projectPath: string
  memory?: string | null
  useBasePrompt?: boolean
  /** Sobrescreve a config global de prompt caching para esta chamada */
  promptCacheEnabled?: boolean
}

/**
 * Monta o system prompt final combinando o prompt base (hard) com o prompt do step.
 *
 * Estrutura com cache habilitado:
 *
 *   [CACHE_BLOCK_START]
 *   ... base prompt (11 seções, idêntico para todos os steps) ...
 *   [CACHE_BLOCK_END]
 *   ---
 *   [step system prompt]       ← varia por step
 *   ---
 *   [memória de contexto]      ← varia por sessão
 *
 * O bloco base é SEMPRE idêntico para o mesmo projectPath, independente do step,
 * memória ou contexto. Isso maximiza cache hits no prefixo.
 *
 * - Se o step tem systemPrompt: base + separador + step prompt
 * - Se o step NAO tem systemPrompt: apenas o base
 * - Se tem memória: injeta a memória como contexto acumulado
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const useBase = options.useBasePrompt !== false
  const cacheEnabled = options.promptCacheEnabled ?? PROMPT_CACHE_ENABLED

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

  // O separador entre partes é padronizado para manter consistência
  const separator = cacheEnabled ? '\n\n--- <!-- cache-dynamic-boundary --> ---\n\n' : '\n\n---\n\n'
  return parts.join(separator)
}

/**
 * Retorna métricas sobre o cache de prompts para monitoramento.
 */
export function getPromptCacheStats(): {
  enabled: boolean
  cachedProjectPaths: number
  projectPaths: string[]
} {
  return {
    enabled: PROMPT_CACHE_ENABLED,
    cachedProjectPaths: basePromptCache.size,
    projectPaths: Array.from(basePromptCache.keys()),
  }
}
