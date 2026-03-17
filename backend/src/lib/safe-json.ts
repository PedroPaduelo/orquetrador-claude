/**
 * Safe JSON.parse that returns a fallback value instead of throwing.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Trunca uma string sem cortar no meio de um surrogate pair (emoji).
 * String.slice() pode cortar entre um high surrogate (0xD800-0xDBFF) e
 * seu low surrogate (0xDC00-0xDFFF), gerando JSON inválido.
 */
export function safeTruncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str || ''
  let end = maxLength
  const code = str.charCodeAt(end - 1)
  // Se o último char é um high surrogate, recua 1 para não separar o par
  if (code >= 0xD800 && code <= 0xDBFF) end--
  return str.slice(0, end)
}

/**
 * Remove surrogates órfãos de uma string (substitui por U+FFFD).
 * Usar como última linha de defesa antes de enviar para APIs externas.
 */
export function sanitizeSurrogates(str: string): string {
  if (!str) return str || ''
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
}
