import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILL = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'SKILL.md')
function skill() { return readFileSync(SKILL, 'utf-8') }

describe('perf-audit feedback P1', () => {
  it('defines On DSH via the deferred tools list', () => {
    expect(skill()).toContain('deferred tools list')
  })
})

describe('perf-audit feedback P2', () => {
  it('states realistic quick/deep ranges with the observed floor', () => {
    const dir = join(__dirname, '..', 'skills', 'magento2-performance-audit')
    const perPage = readFileSync(join(dir, 'references', 'per-page-type-audit.md'), 'utf-8')
    expect(skill()).toContain('20–30m')
    expect(skill()).toContain('144 tool calls')
    expect(perPage).toContain('20–30 min')
  })
})

describe('perf-audit feedback P3', () => {
  it('teaches sh -c quoting once in govard-toolbox', () => {
    const toolbox = readFileSync(join(__dirname, '..', 'skills', 'govard-toolbox', 'SKILL.md'), 'utf-8')
    expect(toolbox).toContain('never join `grep` with `&&`')
    expect(toolbox).toContain('|| true')
  })
})

describe('perf-audit feedback P4', () => {
  it('pins the audit-data.json sidecar schema', () => {
    const base = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
    const template = readFileSync(join(base, 'report-template.md'), 'utf-8')
    expect(template).toContain('audit-data.json')
    expect(template).toContain('distinctShapes')
    expect(template).toContain('"uri"')
  })
})

describe('perf-audit feedback P5', () => {
  it('adds a generic client-facing variant without private branding', () => {
    const base = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
    const template = readFileSync(join(base, 'report-template.md'), 'utf-8')
    const theme = readFileSync(join(base, 'report-theme.md'), 'utf-8')
    expect(template).toContain('audience: dev | client')
    expect(template).toContain('{{brand_logo}}')
    expect(theme).toContain('brand-fixed surfaces')
  })
})

describe('perf-audit feedback P6', () => {
  it('requires full URL for dev and full URI for client', () => {
    const base = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
    const template = readFileSync(join(base, 'report-template.md'), 'utf-8')
    const theme = readFileSync(join(base, 'report-theme.md'), 'utf-8')
    expect(template).toContain('never truncate')
    expect(template).toContain('path + query')
    expect(theme).toContain('overflow-wrap:anywhere')
  })
})
