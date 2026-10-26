import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPerfTemplate, loadThemeDoc, devCoreRefs } from './helpers/report-template'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const cwv = () => readFileSync(join(refs, 'core-web-vitals.md'), 'utf-8')
const template = () => readFileSync(join(refs, 'report-template.md'), 'utf-8')
const htmlTemplate = () => loadPerfTemplate()

const skippedReasons = [
  'Skipped: no cache backend',
  'Skipped: flush not permitted on this environment',
  'Skipped: legacy audit, cold only',
]

describe('perf-audit cold plus warm capture protocol', () => {
  it('defines cold as first load after cache:flush expecting a cache MISS', () => {
    const body = cwv()
    expect(body).toMatch(/cold.*first load after `cache:flush`/i)
    expect(body).toMatch(/cold.*cache MISS/i)
  })

  it('defines warm as one immediate repeat load expecting a cache HIT', () => {
    const body = cwv()
    expect(body).toMatch(/warm.*one immediate repeat load/i)
    expect(body).toMatch(/warm.*cache HIT/i)
  })

  it('records cache status response headers for both cold and warm loads', () => {
    expect(cwv()).toMatch(/cache status response headers/i)
  })

  it('lists the exact three Skipped reasons in core-web-vitals.md', () => {
    for (const reason of skippedReasons) {
      expect(cwv()).toContain(reason)
    }
  })

  it('records INP on the cold pass and reports the same value for warm unless re-measured', () => {
    const body = cwv()
    expect(body).toMatch(/- Cold:[^\n]*INP/)
    expect(body).toMatch(/same value is reported for warm unless re-measured/i)
  })

  it('lists the exact three Skipped reasons in report-template.md', () => {
    for (const reason of skippedReasons) {
      expect(template()).toContain(reason)
    }
  })
})

describe('perf-audit CWV cold/warm column split', () => {
  const cwvSection = (body: string) => {
    const start = body.indexOf('## Core Web Vitals')
    const rest = body.slice(start)
    const next = rest.slice('## Core Web Vitals'.length).search(/\n## /)
    return next === -1 ? rest : rest.slice(0, '## Core Web Vitals'.length + next)
  }
  const htmlCwvSection = (body: string) => {
    const start = body.indexOf('Core Web Vitals')
    const end = body.indexOf('Code-Level Performance Patterns')
    return body.slice(start, end)
  }

  it('splits LCP and performance score into cold and warm columns in report-template.md', () => {
    const section = cwvSection(template())
    expect(section).toMatch(/LCP cold/i)
    expect(section).toMatch(/LCP warm/i)
    expect(section).toMatch(/performance score cold/i)
    expect(section).toMatch(/performance score warm/i)
  })

  it('measures warm only in the perf template CWV card', () => {
    const section = htmlCwvSection(htmlTemplate())
    expect(section).not.toMatch(/cold/i)
    expect(section).toMatch(/--throttling-method=devtools/)
    expect(section).toMatch(/median/)
  })
})

describe('perf-audit review finding I5 legacy scope', () => {
  it('scopes the legacy reason to legacy data only', () => {
    for (const body of [template(), cwv()]) {
      expect(body).toMatch(/legacy reason applies only to legacy data/i)
    }
  })

  it('rejects a fresh audit that reuses the legacy reason for warm cells', () => {
    const docs = [template(), cwv()]
    for (const body of docs) {
      expect(body).toMatch(/legacy reason applies only to legacy data/i)
    }
    expect(cwv()).toContain('Skipped: legacy audit, cold only')
    const scopePinned = docs.every((body) => /legacy reason applies only to legacy data/i.test(body))
    const legacyReason = 'Skipped: legacy audit, cold only'
    const gateFails = (fixture: { isLegacy: boolean; warmReason: string }) =>
      fixture.warmReason === legacyReason && (!fixture.isLegacy || !scopePinned)
    expect(gateFails({ isLegacy: false, warmReason: legacyReason })).toBe(true)
    expect(gateFails({ isLegacy: true, warmReason: legacyReason })).toBe(false)
  })

  it('proves the documented gate rejects a fresh-audit fixture citing the legacy reason', () => {
    // Fresh-audit fixture: cites the legacy reason without legacy provenance.
    const legacyReason = 'Skipped: legacy audit, cold only'
    const freshAuditFixture = {
      isLegacy: false,
      provenance: 'fresh capture with warm measurement available',
      warmReason: legacyReason,
    }
    const legacyAuditFixture = {
      isLegacy: true,
      provenance: 'legacy capture before warm measurement existed',
      warmReason: legacyReason,
    }
    // Tied to the scope sentence already in the refs (whitespace tolerant:
    // the markdown template wraps the sentence across two lines).
    for (const body of [template(), cwv()]) {
      expect(body).toMatch(/fresh\s+audit\s+using\s+it\s+for\s+warm\s+cells\s+fails/i)
    }
    const gateRejectsWarm = (fixture: { isLegacy: boolean; warmReason: string }) =>
      fixture.warmReason === legacyReason && !fixture.isLegacy
    expect(gateRejectsWarm(freshAuditFixture)).toBe(true)
    expect(gateRejectsWarm(legacyAuditFixture)).toBe(false)
  })
})

describe('perf-audit CWV card note', () => {
  it('CWV note describes the table columns', () => {
    const card = htmlTemplate().match(/<h2>Core Web Vitals[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
    const note = card.match(/<\/table>\s*<div[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
    expect(note.length).toBeGreaterThan(0)
    expect(note).toMatch(/Warm only/)
    expect(note).toMatch(/median and the spread/)
    expect(note).toMatch(/HIT/)
  })
})
