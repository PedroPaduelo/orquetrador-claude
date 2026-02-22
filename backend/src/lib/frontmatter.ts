export interface Frontmatter {
  [key: string]: unknown
}

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Supports simple key: value, arrays with - item, and nested values.
 */
export function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = markdown.trim()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: trimmed }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, body: trimmed }
  }

  const yamlBlock = trimmed.substring(3, endIndex).trim()
  const body = trimmed.substring(endIndex + 3).trim()

  const frontmatter: Frontmatter = {}
  let currentKey = ''
  let currentArray: string[] | null = null

  for (const line of yamlBlock.split('\n')) {
    const trimLine = line.trim()
    if (!trimLine) continue

    // Array item: "  - value"
    if (trimLine.startsWith('- ') && currentKey) {
      if (!currentArray) currentArray = []
      currentArray.push(trimLine.substring(2).trim())
      continue
    }

    // If we were building an array, save it
    if (currentArray && currentKey) {
      frontmatter[currentKey] = currentArray
      currentArray = null
    }

    // Key: value pair
    const colonIdx = trimLine.indexOf(':')
    if (colonIdx > 0) {
      currentKey = trimLine.substring(0, colonIdx).trim()
      const value = trimLine.substring(colonIdx + 1).trim()
      if (value) {
        // Remove quotes
        frontmatter[currentKey] = value.replace(/^["']|["']$/g, '')
      }
      // If value is empty, might be an array starting next line
    }
  }

  // Save last array if any
  if (currentArray && currentKey) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, body }
}
