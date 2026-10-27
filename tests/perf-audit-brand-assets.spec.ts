import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPerfTemplate, loadThemeDoc, devCoreRefs } from './helpers/report-template'

// Standalone brand assets shipped for report overlays: mark only, lockup for
// light surfaces, lockup for dark surfaces. The mark is the Maestro M from the
// workspace logo set on the DSH brand tile; these three files are the set.
const assetsDir = join(
  __dirname,
  '..',
  'skills',
  'magento2-dev-core',
  'references',
  'assets',
)
const markFile = join(assetsDir, 'maestro-mark.svg')
const lockupFile = join(assetsDir, 'maestro-lockup.svg')
const darkFile = join(assetsDir, 'maestro-lockup-dark.svg')

// Brand hex allowlist, same values as the brand free gate: every asset hex
// must stay within it so the skill wide hex gate keeps passing.
const hexAllow = new Set(
  [
    '#2563eb',
    '#0a84ff',
    '#1e40af',
    '#0f172a',
    '#64748b',
    '#ffffff',
    '#f8fafc',
    '#e2e8f0',
  ].map((h) => h.toLowerCase()),
)

function hexes(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase())
}

describe('perf-audit brand assets', () => {
  it('ships the three standalone asset files', () => {
    for (const file of [markFile, lockupFile, darkFile]) {
      expect(readFileSync(file, 'utf-8').length).toBeGreaterThan(0)
    }
  })

  it('parses each asset as SVG with a viewBox', () => {
    for (const file of [markFile, lockupFile, darkFile]) {
      const text = readFileSync(file, 'utf-8')
      expect(text).toMatch(/<svg\b[^>]*viewBox\s*=\s*"[^"]+"/)
      expect(text).toMatch(/<\/svg\s*>/)
    }
  })

  it('keeps every asset hex on the allowlist', () => {
    for (const file of [markFile, lockupFile, darkFile]) {
      const bad = hexes(readFileSync(file, 'utf-8')).filter((h) => !hexAllow.has(h))
      expect(bad).toEqual([])
    }
  })

  it('shares the same mark geometry across mark and both lockups', () => {
    const mark = readFileSync(markFile, 'utf-8')
    const rect = mark.match(/<rect\b[^>]*\/>/)?.[0]
    const cut = mark.match(/<path\b[^>]*d="M2 11 L5 4 L8 9 L11 4 L14 11"[^>]*\/>/)?.[0]
    expect(rect).toBeDefined()
    expect(cut).toBeDefined()
    for (const file of [lockupFile, darkFile]) {
      const text = readFileSync(file, 'utf-8')
      expect(text).toContain(rect as string)
      expect(text).toContain(cut as string)
    }
  })

  it('uses the ink wordmark on the light lockup and the light wordmark on dark', () => {
    const lockup = readFileSync(lockupFile, 'utf-8')
    const dark = readFileSync(darkFile, 'utf-8')
    expect(lockup).toMatch(/<text\b[^>]*x="42"[^>]*fill="#0f172a"[^>]*>Maestro<\/text>/)
    expect(dark).toMatch(/<text\b[^>]*x="42"[^>]*fill="#ffffff"[^>]*>Maestro<\/text>/)
  })
})
