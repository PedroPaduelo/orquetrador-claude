/**
 * Output Validator - Structured Outputs (JSON Schema validation)
 *
 * Validates step output against a JSON Schema defined in `step.outputSchema`.
 * Extracts JSON from content that may be wrapped in markdown code blocks,
 * then validates it against the schema using a lightweight recursive validator.
 *
 * Supported JSON Schema features:
 * - Types: string, number, integer, boolean, object, array, null
 * - Object: properties, required, additionalProperties
 * - Array: items
 * - String: minLength, maxLength, enum, pattern
 * - Number: minimum, maximum, exclusiveMinimum, exclusiveMaximum
 * - Combinators: oneOf, anyOf, allOf
 */

export interface OutputValidationResult {
  valid: boolean
  errors: string[]
  extractedJson?: unknown
  rawExtracted?: string
}

/**
 * Try to extract JSON from content that may be wrapped in markdown code blocks
 * or mixed with other text. Tries multiple strategies in order.
 */
export function extractJsonFromContent(content: string): { json: unknown; raw: string } | null {
  // Strategy 1: Try parsing the entire content as JSON directly
  try {
    const trimmed = content.trim()
    const parsed = JSON.parse(trimmed)
    return { json: parsed, raw: trimmed }
  } catch {
    // Not pure JSON, continue with other strategies
  }

  // Strategy 2: Extract from markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/g
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(content)) !== null) {
    matches.push(match[1].trim())
  }

  // Try each code block (prefer later ones as they're often the final output)
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(matches[i])
      return { json: parsed, raw: matches[i] }
    } catch {
      // Not valid JSON in this block
    }
  }

  // Strategy 3: Find JSON-like content using brace/bracket matching
  const jsonStart = content.search(/[\[{]/)
  if (jsonStart !== -1) {
    const startChar = content[jsonStart]
    const endChar = startChar === '{' ? '}' : ']'

    // Try from the last occurrence working backwards (output is usually at the end)
    const lastStart = content.lastIndexOf(startChar)
    for (const start of [lastStart, jsonStart]) {
      let depth = 0
      let inString = false
      let escape = false

      for (let i = start; i < content.length; i++) {
        const ch = content[i]

        if (escape) {
          escape = false
          continue
        }

        if (ch === '\\' && inString) {
          escape = true
          continue
        }

        if (ch === '"') {
          inString = !inString
          continue
        }

        if (inString) continue

        if (ch === startChar) depth++
        else if (ch === endChar) {
          depth--
          if (depth === 0) {
            const candidate = content.slice(start, i + 1)
            try {
              const parsed = JSON.parse(candidate)
              return { json: parsed, raw: candidate }
            } catch {
              break
            }
          }
        }
      }

      if (start === lastStart) continue
    }
  }

  return null
}

/**
 * Validate a value against a JSON Schema definition (recursive).
 * Returns an array of error strings. Empty array = valid.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
  path: string = '$',
): string[] {
  const errors: string[] = []

  // Handle boolean schema
  if (typeof schema === 'boolean') {
    if (!schema) errors.push(`${path}: schema is false (always fails)`)
    return errors
  }

  // Handle combinators first
  if ('allOf' in schema) {
    const allOf = schema.allOf as Record<string, unknown>[]
    for (let i = 0; i < allOf.length; i++) {
      errors.push(...validateAgainstSchema(value, allOf[i], `${path}/allOf[${i}]`))
    }
  }

  if ('anyOf' in schema) {
    const anyOf = schema.anyOf as Record<string, unknown>[]
    const allErrors: string[][] = []
    let matched = false
    for (const sub of anyOf) {
      const subErrors = validateAgainstSchema(value, sub, path)
      if (subErrors.length === 0) {
        matched = true
        break
      }
      allErrors.push(subErrors)
    }
    if (!matched) {
      errors.push(`${path}: does not match any of the anyOf schemas`)
    }
  }

  if ('oneOf' in schema) {
    const oneOf = schema.oneOf as Record<string, unknown>[]
    let matchCount = 0
    for (const sub of oneOf) {
      const subErrors = validateAgainstSchema(value, sub, path)
      if (subErrors.length === 0) matchCount++
    }
    if (matchCount !== 1) {
      errors.push(`${path}: must match exactly one of oneOf schemas (matched ${matchCount})`)
    }
  }

  // Type checking
  if ('type' in schema) {
    const schemaType = schema.type as string | string[]
    const types = Array.isArray(schemaType) ? schemaType : [schemaType]
    const actualType = getJsonType(value)

    if (!types.includes(actualType)) {
      // "integer" should accept numbers that are integers
      const isIntegerMatch = types.includes('integer') && typeof value === 'number' && Number.isInteger(value)
      // "number" should accept integers (integers are a subset of numbers)
      const isNumberMatch = types.includes('number') && typeof value === 'number'
      if (!isIntegerMatch && !isNumberMatch) {
        errors.push(`${path}: expected type ${types.join(' | ')}, got ${actualType}`)
        return errors // Early return: no point checking further constraints for wrong type
      }
    }
  }

  // Null check
  if (value === null || value === undefined) {
    // If type allows null, it's fine (already checked above)
    // Otherwise stop validation of sub-properties
    return errors
  }

  // Enum validation
  if ('enum' in schema) {
    const enumValues = schema.enum as unknown[]
    if (!enumValues.some(v => JSON.stringify(v) === JSON.stringify(value))) {
      errors.push(`${path}: value ${JSON.stringify(value)} not in enum [${enumValues.map(v => JSON.stringify(v)).join(', ')}]`)
    }
  }

  // Const validation
  if ('const' in schema) {
    if (JSON.stringify(value) !== JSON.stringify(schema.const)) {
      errors.push(`${path}: value must be ${JSON.stringify(schema.const)}`)
    }
  }

  // String validations
  if (typeof value === 'string') {
    if ('minLength' in schema && value.length < (schema.minLength as number)) {
      errors.push(`${path}: string length ${value.length} is less than minLength ${schema.minLength}`)
    }
    if ('maxLength' in schema && value.length > (schema.maxLength as number)) {
      errors.push(`${path}: string length ${value.length} exceeds maxLength ${schema.maxLength}`)
    }
    if ('pattern' in schema) {
      const pattern = new RegExp(schema.pattern as string)
      if (!pattern.test(value)) {
        errors.push(`${path}: string does not match pattern "${schema.pattern}"`)
      }
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if ('minimum' in schema && value < (schema.minimum as number)) {
      errors.push(`${path}: value ${value} is less than minimum ${schema.minimum}`)
    }
    if ('maximum' in schema && value > (schema.maximum as number)) {
      errors.push(`${path}: value ${value} exceeds maximum ${schema.maximum}`)
    }
    if ('exclusiveMinimum' in schema && value <= (schema.exclusiveMinimum as number)) {
      errors.push(`${path}: value ${value} must be > exclusiveMinimum ${schema.exclusiveMinimum}`)
    }
    if ('exclusiveMaximum' in schema && value >= (schema.exclusiveMaximum as number)) {
      errors.push(`${path}: value ${value} must be < exclusiveMaximum ${schema.exclusiveMaximum}`)
    }
  }

  // Object validations
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    const obj = value as Record<string, unknown>

    // Required fields
    if ('required' in schema) {
      const required = schema.required as string[]
      for (const field of required) {
        if (!(field in obj)) {
          errors.push(`${path}: missing required field "${field}"`)
        }
      }
    }

    // Properties
    if ('properties' in schema) {
      const properties = schema.properties as Record<string, Record<string, unknown>>
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in obj) {
          errors.push(...validateAgainstSchema(obj[key], propSchema, `${path}.${key}`))
        }
      }
    }

    // additionalProperties
    if ('additionalProperties' in schema && schema.additionalProperties === false) {
      const definedProps = Object.keys((schema.properties || {}) as Record<string, unknown>)
      const patternProps = Object.keys((schema.patternProperties || {}) as Record<string, unknown>)
      for (const key of Object.keys(obj)) {
        if (!definedProps.includes(key) && !patternProps.some(p => new RegExp(p).test(key))) {
          errors.push(`${path}: additional property "${key}" is not allowed`)
        }
      }
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if ('items' in schema) {
      const itemSchema = schema.items as Record<string, unknown>
      for (let i = 0; i < value.length; i++) {
        errors.push(...validateAgainstSchema(value[i], itemSchema, `${path}[${i}]`))
      }
    }

    if ('minItems' in schema && value.length < (schema.minItems as number)) {
      errors.push(`${path}: array has ${value.length} items, minimum is ${schema.minItems}`)
    }
    if ('maxItems' in schema && value.length > (schema.maxItems as number)) {
      errors.push(`${path}: array has ${value.length} items, maximum is ${schema.maxItems}`)
    }
    if ('uniqueItems' in schema && schema.uniqueItems === true) {
      const serialized = value.map(v => JSON.stringify(v))
      if (new Set(serialized).size !== serialized.length) {
        errors.push(`${path}: array items must be unique`)
      }
    }
  }

  return errors
}

/**
 * Get the JSON Schema type name for a JavaScript value.
 */
function getJsonType(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number'
  }
  return typeof value // 'string', 'boolean', 'object'
}

/**
 * Main entry point: validate step output content against a JSON Schema.
 *
 * 1. Extracts JSON from the content (handles markdown code blocks, mixed text)
 * 2. Validates the extracted JSON against the provided schema
 * 3. Returns structured result with errors and extracted data
 */
export function validateStepOutput(
  content: string,
  schema: Record<string, unknown>,
): OutputValidationResult {
  if (!content || !schema || Object.keys(schema).length === 0) {
    return { valid: true, errors: [] }
  }

  // Step 1: Extract JSON from content
  const extracted = extractJsonFromContent(content)
  if (!extracted) {
    return {
      valid: false,
      errors: ['Could not extract valid JSON from step output. The output must contain valid JSON (optionally inside a markdown code block).'],
    }
  }

  // Step 2: Validate against schema
  const errors = validateAgainstSchema(extracted.json, schema)

  return {
    valid: errors.length === 0,
    errors,
    extractedJson: extracted.json,
    rawExtracted: extracted.raw,
  }
}

/**
 * Build a retry message asking Claude to reformat the output to match the schema.
 */
export function buildSchemaRetryMessage(
  originalInput: string,
  validationErrors: string[],
  schema: Record<string, unknown>,
): string {
  const errorList = validationErrors.map(e => `  - ${e}`).join('\n')
  const schemaStr = JSON.stringify(schema, null, 2)

  return [
    'A validacao do output falhou contra o JSON Schema definido para este step.',
    '',
    'Erros encontrados:',
    errorList,
    '',
    'O output DEVE ser um JSON valido que satisfaca este schema:',
    '```json',
    schemaStr,
    '```',
    '',
    'Por favor, gere o output novamente no formato correto.',
    'Retorne APENAS o JSON valido, sem texto adicional antes ou depois.',
    '',
    'Input original:',
    originalInput,
  ].join('\n')
}
