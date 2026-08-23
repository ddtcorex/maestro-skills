/** Parsed SKILL.md frontmatter: every value is a display-ready single-line string. */
export interface Frontmatter {
  [key: string]: string
}

/**
 * Parse the leading YAML frontmatter of a SKILL.md file.
 *
 * Supports single-line values plus block scalars (`|` and `>`): a block scalar
 * folds its more-indented successor lines into one space-joined string, which
 * is enough fidelity for catalog descriptions without a YAML dependency.
 * Sub-keys under a plain `key:` keep the historical flattening: they become
 * top-level entries and the parent key maps to the empty string.
 */
export function parseFrontmatter(rawContent: string): { metadata: Frontmatter; body: string } {
  if (!rawContent.startsWith('---')) return { metadata: {}, body: rawContent }
  const endIdx = rawContent.indexOf('\n---', 3)
  if (endIdx === -1) return { metadata: {}, body: rawContent }

  const yamlLines = rawContent.slice(3, endIdx).split('\n')
  const body = rawContent.slice(endIdx + 4).trim()
  const metadata: Frontmatter = {}
  let blockKey: string | undefined

  for (const line of yamlLines) {
    const trimmed = line.trim()
    const indent = line.length - trimmed.length
    if (blockKey !== undefined) {
      if (trimmed === '') {
        blockKey = undefined
        continue
      }
      if (indent > 0) {
        metadata[blockKey] = (metadata[blockKey] + ' ' + trimmed).replace(/\s+/g, ' ').trim()
        continue
      }
      blockKey = undefined
    }
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx <= 0) continue
    const key = trimmed.slice(0, colonIdx).trim()
    const val = trimmed.slice(colonIdx + 1).trim()
    if (val.startsWith('|') || val.startsWith('>')) {
      metadata[key] = ''
      blockKey = key
      continue
    }
    metadata[key] = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1) : val
  }
  return { metadata, body }
}
