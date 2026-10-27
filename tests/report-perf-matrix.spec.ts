import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { perfScripts } from './helpers/perf-harness'

const devCoreLib = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'lib')
const sentences = () => import(join(devCoreLib, 'sentences.mjs'))
const renderRun = async (...args: unknown[]) => (await import(join(perfScripts, 'render.mjs'))).renderRun(...args)
const { validateFindings } = await import(join(devCoreLib, 'validate.mjs'))

const shape = (sql: string, count: number) => ({ sql, count, time: 0.01 })
const page = (label: string, uri: string, totalQueries: number, extra: Record<string, unknown> = {}) => ({
  label, url: `https://example.test${uri}`, uri, http: 200, totalQueries, pass2Queries: totalQueries, distinctShapes: 2,
  dbTime: 0.2, profilerRoot: 1.5, ttfbUncachedMs: 1500, template: null, productCount: null,
  shapes: [shape('SELECT * FROM stock WHERE product_id = ?', Math.round(totalQueries / 2)), shape('SELECT 1', 1)], ...extra,
})
const urlSet = [
  { label: 'home', uri: '/' },
  { label: 'category_small', uri: '/s.html', productCount: 10 },
  { label: 'category_large', uri: '/l.html', productCount: 110 },
  { label: 'product_1', uri: '/p.html' },
]
const audit = (pages: unknown[], extra: Record<string, unknown> = {}) => ({
  scope: 'deep', generatedAt: '2026-10-26T00:00:00Z', templateVersion: 1, skillVersion: '0.0.0-test',
  urlSet: urlSet.map((u) => ({ ...u, url: `https://example.test${u.uri}`, template: u.label === 'category_small' ? 'app/design/frontend/Acme/child/Magento_Catalog/templates/product/list.phtml' : null })),
  pages, attribution: { home: { 'SELECT * FROM stock WHERE product_id = ?': [['app/code/Acme/Stock/Model/Load.php:42 (Acme\\Stock\\Model\\Load->get)', 100]] } }, passMismatch: [], ...extra,
})
const warm = (score: number) => ({ runs: [], median: { score, lcpMs: 1200, cls: 0.01, ttfbMs: 90 }, spread: { score: 4, lcpMs: 100 }, hitSource: 'x-magento-cache-debug' })
const sections = {
  meta: { title: 'Performance Audit - acme-shop', date: '2026-10-26' },
  sections: { infra: { status: 'ok', verdict: 'Healthy', checks: [{ state: 'ok', text: 'Redis reachable' }] } },
  recommendations: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
  coverageNote: 'All frozen URLs captured twice.',
}

function writeRun(dir: string, pages: unknown[], extra: Record<string, unknown> = {}, cwvScores: Record<string, unknown> = {}) {
  mkdirSync(join(dir, 'cwv'), { recursive: true })
  writeFileSync(join(dir, 'audit-data.json'), JSON.stringify(audit(pages, extra)))
  writeFileSync(join(dir, 'cwv', 'cwv.json'), JSON.stringify(cwvScores))
  writeFileSync(join(dir, 'sections.json'), JSON.stringify(sections))
}

describe('sentence templates', () => {
  it('describes a per-page delta', async () => {
    const { pageDelta } = await sentences()
    expect(pageDelta(page('home', '/', 400), page('home', '/', 300))).toBe('home: 400 to 300 uncached queries (-25%)')
  })

  it('describes the per-extra-product slope between the smallest and largest category', async () => {
    const { perExtraProductSlope } = await sentences()
    const pages = [page('category_small', '/s.html', 300, { productCount: 10 }), page('category_large', '/l.html', 1300, { productCount: 110 })]
    expect(perExtraProductSlope(pages)).toBe('about 10 queries per extra product (category_small 10 products, category_large 110 products)')
    expect(perExtraProductSlope([page('home', '/', 1)])).toBe('')
  })

  it('lists the largest shape reductions', async () => {
    const { topShapeReductions } = await sentences()
    const before = [page('home', '/', 400)]
    const after = [page('home', '/', 100)]
    expect(topShapeReductions(before, after, 1)).toEqual(['SELECT * FROM stock WHERE product_id = ?: 200 to 50 calls'])
  })
})

describe('perf run rendering', () => {
  let base: string
  let before: string
  let after: string
  const config = (extra: Record<string, unknown> = {}) => ({ projectRoot: '/x', baseUrl: 'https://example.test', urlSet, trace: [], themeOverrides: ['Acme/child'], ...extra })
  const pagesBefore = () => [page('home', '/', 400), page('category_small', '/s.html', 300, { productCount: 10 }), page('category_large', '/l.html', 1300, { productCount: 110 }), page('product_1', '/p.html', 200)]
  const pagesAfter = () => [page('home', '/', 300), page('category_small', '/s.html', 200, { productCount: 10 }), page('category_large', '/l.html', 700, { productCount: 110 }), page('product_1', '/p.html', 150)]
  const cwvAll = { home: warm(80), category_small: warm(70), category_large: warm(60), product_1: warm(75) }
  const html = (dir: string) => readFileSync(join(dir, 'report.html'), 'utf-8')
  const matrix = (text: string) => text.match(/<h2>Before\/After Comparison Matrix[\s\S]*?<\/table>/)?.[0] ?? ''

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'perf-render-'))
    before = join(base, 'before')
    after = join(base, 'after')
    writeRun(before, pagesBefore(), {}, cwvAll)
    writeRun(after, pagesAfter(), {}, cwvAll)
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('renders the uncached and warm columns, never a cold one', async () => {
    await renderRun(after, config(), { compare: before })
    const m = matrix(html(after))
    for (const col of ['Queries', 'Profiler root', 'TTFB (uncached)', 'Score', 'LCP', 'CLS', 'TTFB (warm)', 'HIT proof']) expect(m).toContain(`<th>${col}</th>`)
    expect(m).not.toMatch(/cold/i)
    expect(m).toContain('400 → 300')
  })

  it('marks an after-side 500 as a regression and raises it in the verdict', async () => {
    const broken = pagesAfter()
    broken[3] = { ...broken[3], http: 500 }
    writeRun(after, broken, {}, cwvAll)
    await renderRun(after, config(), { compare: before })
    const text = html(after)
    expect(matrix(text)).toContain('Skipped: non-200 on after side (regression)')
    expect(text).toMatch(/data-report-verdict>[^<]*product_1[^<]*regression/)
    const findings = JSON.parse(readFileSync(join(after, 'findings.json'), 'utf-8'))
    expect(findings.findings.some((f: { rule: string }) => f.rule === 'perf-audit.non-200-regression')).toBe(true)
  })

  it('marks a before-side 500 with the before-side reason', async () => {
    const broken = pagesBefore()
    broken[0] = { ...broken[0], http: 500 }
    writeRun(before, broken, {}, cwvAll)
    await renderRun(after, config(), { compare: before })
    expect(matrix(html(after))).toContain('Skipped: non-200 on before side')
  })

  it('refuses a before side measured on the older protocol', async () => {
    const legacy = JSON.parse(readFileSync(join(before, 'audit-data.json'), 'utf-8'))
    delete legacy.templateVersion
    writeFileSync(join(before, 'audit-data.json'), JSON.stringify(legacy))
    await expect(renderRun(after, config(), { compare: before })).rejects.toMatchObject({ reason: 'Skipped: before side measured on an older protocol, re-measure with switch' })
  })

  it('fills the verdict and the database bullets from the sentence templates', async () => {
    const { pageDelta, topShapeReductions, perExtraProductSlope } = await sentences()
    await renderRun(after, config(), { compare: before })
    const text = html(after)
    const b = pagesBefore()
    const a = pagesAfter()
    expect(text).toContain(pageDelta(b[0], a[0]))
    expect(text).toContain(topShapeReductions(b, a, 3)[0])
    expect(text).toContain(perExtraProductSlope(a))
  })

  it('rejects a section number without evidence, naming the key', async () => {
    writeFileSync(join(after, 'sections.json'), JSON.stringify({ ...sections, sections: { cron: { status: 'warn', failedJobs: 3, checks: [] } } }))
    await expect(renderRun(after, config(), { compare: before })).rejects.toThrow(/sections\.cron/)
  })

  it('accepts a section number with evidence', async () => {
    writeFileSync(join(after, 'sections.json'), JSON.stringify({ ...sections, sections: { cron: { status: 'warn', failedJobs: 3, checks: [], evidence: { command: 'bin/magento cron:status', excerpt: '3 failed' } } } }))
    await expect(renderRun(after, config(), { compare: before })).resolves.toBeTruthy()
  })

  it('fails the gate when a theme override is rendered by no sample', async () => {
    await expect(renderRun(after, config({ themeOverrides: ['Acme/child', 'Acme/other'] }), { compare: before })).rejects.toThrow(/Acme\/other/)
  })

  it('renders the client audience as one page with a link to the dev report', async () => {
    await renderRun(after, config(), { compare: before, audience: 'client' })
    const text = readFileSync(join(after, 'client', 'report.html'), 'utf-8')
    const headings = [...text.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    expect(headings).toEqual(['Verdict', 'Before/After Comparison Matrix', 'Top Recommendations', 'Coverage Note'])
    expect((text.match(/<li>/g) ?? []).length).toBe(5)
    expect(text).toContain('href="../report.html"')
    expect(text).toContain('<meta name="maestro-report-contract" content="1">')
    expect(text).toContain('aria-label="Maestro logo"')
  })

  it('writes a valid perf findings.json with M2-PERF codes', async () => {
    await renderRun(after, config(), { compare: before })
    const findings = JSON.parse(readFileSync(join(after, 'findings.json'), 'utf-8'))
    expect(validateFindings(findings)).toEqual([])
    expect(findings.tool).toBe('magento2-performance-audit')
    expect(findings.findings.some((f: { code: string; file: string }) => f.code === 'M2-PERF-001' && f.file === 'app/code/Acme/Stock/Model/Load.php')).toBe(true)
  })

  it('raises N+1 findings only for code the project can change, never Magento core', async () => {
    const data = JSON.parse(readFileSync(join(after, 'audit-data.json'), 'utf-8'))
    data.attribution.home['SELECT * FROM cms_block WHERE block_id = ?'] = [['vendor/magento/module-cms/Model/ResourceModel/Block.php:10 (Magento\\Cms\\Block->load)', 88]]
    writeFileSync(join(after, 'audit-data.json'), JSON.stringify(data))
    await renderRun(after, config(), { compare: before })
    const findings = JSON.parse(readFileSync(join(after, 'findings.json'), 'utf-8'))
    expect(findings.findings.some((f: { file: string }) => f.file.startsWith('vendor/magento/'))).toBe(false)
    expect(findings.findings.some((f: { file: string }) => f.file === 'app/code/Acme/Stock/Model/Load.php')).toBe(true)
  })

  it('renders a baseline without a comparison', async () => {
    await renderRun(after, config(), {})
    expect(html(after)).toContain('Baseline recorded: 2026-10-26')
  })
})
