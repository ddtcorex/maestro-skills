import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const skillDir = join(__dirname, '..', 'skills', 'magento2-performance-audit')
const fixturesDir = join(__dirname, 'fixtures')
const beforePath = join(fixturesDir, 'perf-comparison-before.json')
const afterPath = join(fixturesDir, 'perf-comparison-after.json')

// Batch spec files covered by the guard-only rule below.
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

// Guard definition: the single brand term this gate scans for.
const brandPattern = /sutunam/i
// A line is a guard line when the term appears only as the asserted pattern.
// The alternation names assertion syntax only: a bare word must never excuse
// a hit, or prose could leak the term beside an innocent word.
const guardLine = /toMatch|RegExp|brandPattern/i
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

describe('perf-audit brand free gate', () => {
  it('keeps skills/magento2-performance-audit free of brand terms', () => {
    const hits: string[] = []
    for (const file of walkFiles(skillDir)) {
      if (brandPattern.test(readFileSync(file, 'utf-8'))) hits.push(file)
    }
    expect(hits).toEqual([])
  })

  it('keeps the comparison fixtures free of brand terms', () => {
    for (const file of [beforePath, afterPath]) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(brandPattern)
    }
  })

  // Commit subjects and bodies are a manual controller gate recorded in the
  // SDD ledger, not a vitest assertion (history greps are environment
  // fragile). This test asserts batch spec file content only.
  it('keeps batch spec files free of brand terms outside guard assertions', () => {
    for (const name of batchSpecs) {
      const text = readFileSync(join(__dirname, name), 'utf-8')
      const proseHits = text
        .split('\n')
        .filter((line) => brandPattern.test(line) && !guardLine.test(line))
      expect(proseHits).toEqual([])
    }
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
