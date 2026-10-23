import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const cwv = () => readFileSync(join(refs, 'core-web-vitals.md'), 'utf-8')
const template = () => readFileSync(join(refs, 'report-template.md'), 'utf-8')
const htmlTemplate = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')

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

  it('splits LCP and performance score into cold and warm columns in report.html.template', () => {
    const section = htmlCwvSection(htmlTemplate())
    expect(section).toMatch(/LCP cold/i)
    expect(section).toMatch(/LCP warm/i)
    expect(section).toMatch(/performance score cold/i)
    expect(section).toMatch(/performance score warm/i)
  })
})
