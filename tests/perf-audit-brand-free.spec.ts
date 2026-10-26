import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPerfTemplate, loadThemeDoc, devCoreRefs } from './helpers/report-template'

const skillDir = join(__dirname, '..', 'skills', 'magento2-performance-audit')
const refsDir = join(skillDir, 'references')
// Task 1 files: the only references carrying brand defaults.
const brandFiles = [
  join(devCoreRefs, 'report-perf.html.template'),
  join(devCoreRefs, 'report-theme.css'),
  join(devCoreRefs, 'report-theme.md'),
]
const fixturesDir = join(__dirname, 'fixtures')
const beforePath = join(fixturesDir, 'perf-comparison-before.json')
const afterPath = join(fixturesDir, 'perf-comparison-after.json')

// Batch spec files covered by the token allowlist pin below.
const batchSpecs = [
  'perf-audit-brand-slots.spec.ts',
  'perf-audit-comparison.spec.ts',
  'perf-audit-cold-warm.spec.ts',
  'perf-audit-feedback.spec.ts',
  'perf-audit-brand-free.spec.ts',
]

const sixColumns = [
  'query count',
  'LCP cold',
  'LCP warm',
  'CLS',
  'performance score cold',
  'performance score warm',
]

// Maestro-positive allowlist: the only brand tokens permitted in skill
// references, case insensitive throughout. Sample placeholders round it out:
// every absolute sample host uses example.test, every sample path uses sample-*.
// The gate is positive on purpose, so no outside brand term is ever needed as
// a test literal.
const brandTerm = /maestro/i
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
// Stock severity tokens: not brand, kept so pass/warn/fail chips keep their
// meaning in both modes.
const stockHexAllow = new Set(
  [
    '#16a34a',
    '#dcfce7',
    '#bbf7d0',
    '#ca8a04',
    '#fef9c3',
    '#fde68a',
    '#dc2626',
    '#fee2e2',
    '#fecaca',
  ].map((h) => h.toLowerCase()),
)
// Allowlisted faces plus the generic system fallbacks: neither is brand, and
// the fallbacks keep offline reports readable with no remote fonts.
const fontAllow = new Set(['inter', 'jetbrains mono'])
const fontSystem = new Set([
  'system-ui',
  '-apple-system',
  'segoe ui',
  'roboto',
  'helvetica',
  'arial',
  'sans-serif',
  'ui-monospace',
  'sfmono-regular',
  'menlo',
  'consolas',
  'monospace',
])
// Absolute sample hosts in the Task 1 files: placeholders or the token source.
// Anchored full match: a suffix pin would let outside hosts through.
const hostAllow = /^example\.test$/i
const dashPattern = /[\u2013\u2014]/

function walkFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else out.push(full)
  }
  return out
}

function hexes(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase())
}

function families(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/font-family\s*[:=]\s*["']?([^;}"']+)/gi)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^["']|["']$/g, '').toLowerCase()
      if (name) out.push(name)
    }
  }
  return out
}

describe('perf-audit brand allowlist gate', () => {
  it('defaults the Task 1 references to the allowlisted brand term', () => {
    for (const file of brandFiles) {
      expect(readFileSync(file, 'utf-8')).toMatch(brandTerm)
    }
  })

  it('carries no DDTCoreX brand in the skill', () => {
    for (const file of [...walkFiles(skillDir), ...walkFiles(devCoreRefs)]) {
      expect(readFileSync(file, 'utf-8'), file).not.toMatch(/ddtcorex/i)
    }
  })

  it('allows only listed hexes in skill references', () => {
    const bad: string[] = []
    for (const file of [...walkFiles(skillDir), ...walkFiles(devCoreRefs)]) {
      for (const h of hexes(readFileSync(file, 'utf-8'))) {
        if (!hexAllow.has(h) && !stockHexAllow.has(h)) bad.push(`${file}: ${h}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('allows only listed fonts and ships the code face', () => {
    const bad: string[] = []
    for (const file of [...walkFiles(skillDir), ...walkFiles(devCoreRefs)]) {
      for (const name of families(readFileSync(file, 'utf-8'))) {
        if (!fontAllow.has(name) && !fontSystem.has(name)) bad.push(`${file}: ${name}`)
      }
    }
    expect(bad).toEqual([])
    expect(loadPerfTemplate()).toMatch(/JetBrains Mono/)
  })

  it('keeps the logo inline, never an external reference', () => {
    for (const file of brandFiles) {
      const text = readFileSync(file, 'utf-8')
      expect(text).not.toMatch(/<img\b/i)
      expect(text).not.toMatch(/(src|href)\s*=\s*["'][^"']*logo[^"']*["']/i)
    }
  })

  it('keeps absolute hosts in the Task 1 files on the placeholder allowlist', () => {
    for (const file of brandFiles) {
      const text = readFileSync(file, 'utf-8')
      const schemeHosts = [...text.matchAll(/https?:\/\/([^/\s"'`]+)/gi)].map((m) =>
        m[1].toLowerCase(),
      )
      // Bare www hosts carry no scheme (token source stamp), so scan them too.
      const bareHosts = [...text.matchAll(/(?<![/:@\w.-])www\.[^\s"'`\/]+/gi)].map((m) =>
        m[0].toLowerCase().replace(/[.,;:!?]+$/, ''),
      )
      for (const host of [...schemeHosts, ...bareHosts]) {
        expect(host).toMatch(hostAllow)
      }
    }
  })

  it('anchors the brand match so lookalike suffixes do not pass', () => {
    expect('example.test').toMatch(hostAllow)
    expect('www.example.test').not.toMatch(hostAllow)
    expect('notexample.test').not.toMatch(hostAllow)
  })

  // Spec files carry the allowlist itself, so they must stay within it: no
  // spec may smuggle an unlisted brand value past the gate above.
  it('keeps batch spec files within the same token allowlist', () => {
    const bad: string[] = []
    for (const name of batchSpecs) {
      const text = readFileSync(join(__dirname, name), 'utf-8')
      for (const h of hexes(text)) {
        if (!hexAllow.has(h) && !stockHexAllow.has(h)) bad.push(`${name}: ${h}`)
      }
      for (const face of families(text)) {
        if (!fontAllow.has(face) && !fontSystem.has(face)) bad.push(`${name}: ${face}`)
      }
    }
    expect(bad).toEqual([])
  })
})

describe('perf-audit comparison fixtures', () => {
  const load = (file: string) => JSON.parse(readFileSync(file, 'utf-8')) as {
    urlSet: unknown
    comparison: { columns: string[]; rows: Array<Record<string, unknown>> }
  }

  it('gives both fixtures identical urlSet values', () => {
    expect(load(afterPath).urlSet).toEqual(load(beforePath).urlSet)
  })

  it('carries all six matrix columns with cold plus warm values on every row', () => {
    for (const file of [beforePath, afterPath]) {
      const data = load(file)
      const columns = data.comparison.columns.map((c) => c.toLowerCase()).sort()
      expect(columns).toEqual([...sixColumns].map((c) => c.toLowerCase()).sort())
      expect(data.comparison.rows.length).toBe(
        (data.urlSet as unknown[]).length,
      )
      for (const row of data.comparison.rows) {
        for (const col of sixColumns) {
          expect(row[col]).toBeDefined()
          expect(String(row[col]).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps fixtures free of em and en dashes', () => {
    for (const file of [beforePath, afterPath]) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(dashPattern)
    }
  })
})
