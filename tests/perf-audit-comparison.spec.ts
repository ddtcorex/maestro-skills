import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPerfTemplate, loadThemeDoc, devCoreRefs } from './helpers/report-template'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report-template.md'), 'utf-8')
const htmlTemplate = () => loadPerfTemplate()
const perPage = () => readFileSync(join(refs, 'per-page-type-audit.md'), 'utf-8')
const cwvText = () => readFileSync(join(refs, 'core-web-vitals.md'), 'utf-8')

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

  it('keeps the full new comparison prose and the audience line free of em and en dashes', () => {
    // The heading scan above misses body prose: the Audience line carries the
    // same em-dash style the headings once had, so the scan covers it plus
    // every non-empty line of the gate and matrix sections.
    const body = template()
    const audience = body.split('\n').filter((line) => line.startsWith('Audience:'))
    expect(audience.length).toBeGreaterThanOrEqual(1)
    const section = body.slice(body.indexOf('## Comparison Gate'), body.indexOf('## Infrastructure'))
    const proseLines = section.split('\n').filter((line) => line.trim().length > 0)
    expect(proseLines.length).toBeGreaterThanOrEqual(4)
    for (const line of [...audience, ...proseLines]) {
      expect(line).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('keeps the rewritten HTML comparison prose free of em and en dashes', () => {
    // Mirrors the markdown scan above for the rewritten HTML prose line
    // (report.html.template:86 area): the same no-em-en-dash rule applies.
    const html = htmlTemplate()
    const start = html.indexOf('Before/After Comparison Matrix')
    expect(start).toBeGreaterThan(-1)
    const after = html.slice(start)
    const nextCard = after.indexOf('<div class="card">', 1)
    const section = nextCard === -1 ? after : after.slice(0, nextCard)
    const proseLines = section.split('\n').filter((line) => line.trim().length > 0)
    expect(proseLines.length).toBeGreaterThanOrEqual(4)
    for (const line of proseLines) {
      expect(line).not.toMatch(/[\u2013\u2014]/)
    }
    const proseLine = section.split('\n').find((line) => line.includes('One row per page'))
    expect(proseLine).toBeDefined()
    expect(proseLine as string).toContain('Closed fixed column set')
    expect(proseLine as string).not.toMatch(/[\u2013\u2014]/)
  })

  it('hyphenates re-audit and top-level compounds where those words appear', () => {
    for (const body of [template(), htmlTemplate()]) {
      expect(body).toMatch(/re-audit/i)
    }
    expect(template()).toMatch(/top-level/i)
    expect(template()).not.toMatch(/re audit/i)
    expect(template()).not.toMatch(/top level/i)
    expect(htmlTemplate()).not.toMatch(/re audit/i)
  })
})

describe('perf-audit baseline mode without prior audit', () => {
  it('omits the matrix on a first audit and records a baseline note instead', () => {
    expect(template()).toMatch(/no prior URL set/i)
    expect(template()).toMatch(/comparison deferred/i)
    expect(template()).toMatch(/Baseline recorded/i)
    expect(htmlTemplate()).toMatch(/no prior URL set/i)
    expect(htmlTemplate()).toMatch(/Baseline recorded/i)
  })
})

describe('perf-audit review findings C2 and I4', () => {
  it('uses only sample placeholder paths with no French taxonomy path', () => {
    expect(template()).toContain('sample-')
    expect(cwvText()).toContain('sample-')
    for (const body of [template(), htmlTemplate(), cwvText()]) {
      expect(body).not.toContain('eveil')
      expect(body).not.toContain('livre-sonore')
    }
    expect(template()).not.toContain('store.test')
    expect(cwvText()).not.toContain('your-store.test')
  })

  it('keeps every example.test sample path on sample-', () => {
    for (const body of [template(), cwvText()]) {
      const urls = [...body.matchAll(/example\.test(\/\S*)/gi)].map((m) => m[1])
      const paths = urls.filter((p) => p && p !== '/' && p.includes('.html'))
      expect(paths.length).toBeGreaterThan(0)
      for (const p of paths) {
        expect(p).toMatch(/sample-/)
      }
    }
  })

  it('states the matrix CLS column reports the cold value', () => {
    expect(template()).toMatch(/CLS column reports the cold value/i)
    expect(htmlTemplate()).toMatch(/CLS column reports the cold value/i)
  })
})
