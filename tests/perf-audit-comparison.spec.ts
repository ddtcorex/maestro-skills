import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report-template.md'), 'utf-8')
const htmlTemplate = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')
const perPage = () => readFileSync(join(refs, 'per-page-type-audit.md'), 'utf-8')

describe('perf-audit frozen URL set and comparison gate', () => {
  it('documents the urlSet schema block in the sidecar section', () => {
    expect(template()).toContain('urlSet')
  })

  it('states the URI normalization rule (path plus query, scheme and host ignored, trailing slash normalized)', () => {
    const body = template()
    expect(body).toMatch(/path plus query/i)
    expect(body).toMatch(/scheme and host ignored/i)
    expect(body).toMatch(/trailing slash normalized/i)
  })

  it('states the dagger footnote rule for 301 substitutions', () => {
    const body = template()
    expect(body).toMatch(/301/)
    expect(body).toMatch(/dagger/i)
  })

  it('states the hard gate for divergent URL sets without a recorded reason', () => {
    expect(template()).toMatch(/without a recorded reason/i)
  })

  it('notes in per-page-type-audit.md that the audited URL set is frozen and reused for later comparisons', () => {
    const body = perPage()
    expect(body).toMatch(/frozen/i)
    expect(body).toMatch(/reused for later comparisons/i)
  })
})

describe('perf-audit same metrics comparison matrix', () => {
  const sixColumns = [
    'query count',
    'LCP cold',
    'LCP warm',
    'CLS',
    'performance score cold',
    'performance score warm',
  ]

  it('documents the before/after matrix with the closed six columns in report-template.md', () => {
    const body = template()
    expect(body).toMatch(/before\/after/i)
    for (const col of sixColumns) {
      expect(body).toMatch(new RegExp(col, 'i'))
    }
    expect(body).toMatch(/column set extends only through .*template update/i)
  })

  it('renders the same six-column before/after matrix in report.html.template', () => {
    const body = htmlTemplate()
    expect(body).toMatch(/before\/after/i)
    for (const col of sixColumns) {
      expect(body).toMatch(new RegExp(col, 'i'))
    }
  })

  it('states a metric recorded on one side only is a gate failure, not a blank cell', () => {
    expect(template()).toMatch(/one side only.*gate failure/i)
    expect(htmlTemplate()).toMatch(/one side only.*gate failure/i)
  })

  it('grandfathers legacy audits with the exact Skipped reason in both templates', () => {
    expect(template()).toContain('Skipped: legacy audit, cold only')
    expect(htmlTemplate()).toContain('Skipped: legacy audit, cold only')
  })

  it('uses plain hyphens in the comparison gate headings and sample matrix rows', () => {
    const body = template()
    expect(body).toContain('## Comparison Gate - Frozen URL Set')
    expect(body).toContain('## Comparison Matrix - Same Metrics Before/After')
    expect(body).toContain('home - before/after')
    expect(body).toContain('category_small - before/after')
  })

  it('keeps the comparison gate headings and sample matrix rows free of em and en dashes', () => {
    const lines = template().split('\n')
    const targets = lines.filter(
      (line) =>
        line.startsWith('## Comparison Gate') ||
        line.startsWith('## Comparison Matrix') ||
        line.startsWith('| home') ||
        line.startsWith('| category_small'),
    )
    expect(targets.length).toBeGreaterThanOrEqual(4)
    for (const line of targets) {
      expect(line).not.toMatch(/[\u2013\u2014]/)
    }
  })
})
