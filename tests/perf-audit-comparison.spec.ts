import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report-template.md'), 'utf-8')
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
