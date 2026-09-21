import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILL = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'SKILL.md')
function skill() { return readFileSync(SKILL, 'utf-8') }

describe('perf-audit feedback P1', () => {
  it('states the native-tool preference as a capability conditional', () => {
    expect(skill()).toContain('If the runtime provides a native query-log stats tool')
    // The tool name must not come back: the capability phrasing is the contract.
    expect(skill()).not.toContain('maestro_perf_log_stats')
  })
})

describe('perf-audit feedback P2', () => {
  it('states realistic quick/deep ranges with the observed floor', () => {
    const dir = join(__dirname, '..', 'skills', 'magento2-performance-audit')
    const perPage = readFileSync(join(dir, 'references', 'per-page-type-audit.md'), 'utf-8')
    const template = readFileSync(join(dir, 'references', 'report-template.md'), 'utf-8')
    expect(skill()).toContain('20–30m')
    expect(skill()).toContain('144 tool calls')
    expect(perPage).toContain('20–30 min')
    expect(template).toContain('5–10m')
    expect(template).not.toContain('3–5m')
  })

  it('stamps the observed floor so the number cannot rot silently', () => {
    // House rule: a prose table of environment facts must carry a verified-on date.
    expect(skill()).toMatch(/Observed floor \(reference large-project audit, verified \d{4}-\d{2}-\d{2}/)
  })

  it('labels the Per-Page Detail URL example for both audiences', () => {
    const template = readFileSync(join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references', 'report-template.md'), 'utf-8')
    // The example must not show a bare absolute URL: dev gets scheme+host, client gets the URI.
    expect(template).toContain('dev: `https://example.test/')
    expect(template).toContain('client: `/')
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
    expect(theme).toContain('class="url"')
  })
})

describe('review fix pass', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', 'skills', rel), 'utf-8')

  it('labels the 22m floor as whole-audit time, distinct from capture time', () => {
    // The reviewer caught "~22m observed floor" sitting next to a "20–30m" deep cap
    // while the reference file said captures cost ~2.5-3 min. Both numbers are real
    // but measure different scopes; the text must say so.
    expect(skill()).toContain('for the **whole audit**')
    expect(skill()).toContain('Captures alone are only ~2.5–3 min')
    expect(skill()).toContain('~2.5-3 min **on their own**')
    expect(read('magento2-performance-audit/references/per-page-type-audit.md')).toContain('**for the captures only**')
  })

  it('keeps diagram-studio tool-neutral for verify and drift', () => {
    const ds = read('diagram-studio/SKILL.md')
    expect(ds).not.toContain('mermaid_verify')
    expect(ds).not.toContain('mermaid_drift')
    // The capability phrasing plus a working fallback must remain.
    expect(ds).toMatch(/native Mermaid verification tool/)
    expect(ds).toContain('verify-mermaid.mjs')
  })

  it('quotes govard sh -c correctly in the perf-audit trap', () => {
    // The new quoting lesson forbids nested double quotes; this skill's own trap
    // contradicted it.
    expect(skill()).not.toMatch(/govard sh -c "[^"]*"/)
    expect(skill()).toContain("govard sh -c '")
  })

  it('leaves no dangling DSH tool map pointer in README', () => {
    const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf-8')
    // CHANGELOG legitimately keeps history; README must describe current state.
    expect(readme).not.toContain('DSH tool map')
  })
})
