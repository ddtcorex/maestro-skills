import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const templatePath = join(__dirname, '..', 'skills', 'magento2-dev-core', 'references', 'report-perf.html.template')
const renderCli = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'render.mjs')
const fixture = join(__dirname, 'fixtures', 'report', 'perf-audit-data.json')

// Every marker the engine can fill: render.mjs built-ins plus the buildPerf slot keys.
const PRODUCERS = new Set([
  'contract',
  'theme_css',
  'brand_logo',
  'title',
  'date',
  'verdict',
  'host',
  'govard_version',
  'profile',
  'magento_version',
  'php_version',
  'mariadb_version',
  'redis_version',
  'opensearch_version',
  'fpc',
  'scope',
  'page_count',
  'urls_rows',
  'perpage_details',
  'perpage_badge',
  'perpage_status',
  'repeated_rows',
  'db_rows',
  'recommendations',
  'matrix',
  'cwv_rows',
  'db_bullets',
  'rec_count',
  'coverage_note',
  'infra_badge',
  'infra_status',
  'infra_checks',
  'infra_verdict',
  'infra_sub',
  'cache_badge',
  'cache_status',
  'cache_checks',
  'cache_verdict',
  'cache_sub',
  'cache_inv_badge',
  'cache_inv_status',
  'cache_inv_checks',
  'ajax_badge',
  'ajax_status',
  'ajax_checks',
  'indexer_checks',
  'indexer_verdict',
  'indexer_sub',
  'cron_verdict',
  'cron_sub',
  'timers_content',
  'slow_queries_badge',
  'slow_queries_status',
  'slow_queries_checks',
  'slow_queries_verdict',
  'slow_queries_sub',
  'code_patterns_badge',
  'code_patterns_status',
  'code_patterns_checks',
  'code_patterns_verdict',
  'code_patterns_sub',
  'cwv_badge',
  'cwv_status',
])

const markers = (text: string) => [...text.matchAll(/{{([a-zA-Z_0-9]+)}}/g)].map((m) => m[1])

describe('perf template slot coverage', () => {
  it('fills every template marker from an engine producer', () => {
    const template = readFileSync(templatePath, 'utf-8')
    const orphaned = [...new Set(markers(template))].filter((m) => !PRODUCERS.has(m))
    expect(orphaned, `markers with no producer: ${orphaned.join(', ')}`).toEqual([])
  })

  describe('rendered output', () => {
    let out: string
    beforeAll(() => {
      out = mkdtempSync(join(tmpdir(), 'report-perf-slots-'))
      execFileSync('node', [renderCli, 'render', '--layout', 'perf', '--audience', 'dev', '--data', fixture, '--out', out])
    })
    afterAll(() => rmSync(out, { recursive: true, force: true }))

    it('renders no legacy card left empty by a missing producer', () => {
      const html = readFileSync(join(out, 'report.html'), 'utf-8')
      expect(html).not.toContain('DB slow')
      expect(html).not.toContain('(audit')
    })

    it('renders agent slow-query and code-pattern sections with an explicit skip when absent', () => {
      const html = readFileSync(join(out, 'report.html'), 'utf-8')
      for (const title of ['Slow Queries', 'Code-Level Performance Patterns']) {
        expect(html).toContain(title)
        const card = html.slice(html.indexOf(title))
        expect(card).toContain('Skipped: no data')
      }
    })

    it('renders provided slow-query and code-pattern checks instead of the skip text', async () => {
      const engine = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'render.mjs')
      const { renderReport } = await import(engine)
      const dir = mkdtempSync(join(tmpdir(), 'report-perf-agent-sections-'))
      try {
        await renderReport({
          layout: 'perf',
          audience: 'dev',
          outDir: dir,
          data: {
            meta: { title: 'Sections', date: '2026-10-26' },
            verdict: 'v',
            scope: 'deep',
            urlSet: [],
            pages: [],
            recommendations: [],
            coverageNote: 'n',
            sections: {
              slow_queries: {
                status: 'warn',
                statusText: 'one full scan found',
                verdict: 'One EXPLAINed scan',
                sub: 'cms_page on every CMS hit',
                checks: [{ state: 'fail', text: 'cms_page full scan type ALL' }],
                evidence: { command: 'EXPLAIN SELECT', excerpt: 'type ALL' },
              },
              code_patterns: {
                status: 'warn',
                statusText: 'one per-item loop found',
                verdict: 'One batchable loop',
                sub: 'rule load per order item',
                checks: [{ state: 'fail', text: 'Octipas per-rule load' }],
                evidence: { command: 'grep foreach', excerpt: 'Order.php' },
              },
            },
          },
        })
        const html = readFileSync(join(dir, 'report.html'), 'utf-8')
        for (const needle of ['Slow Queries', 'one full scan found', 'cms_page full scan type ALL', 'Code-Level Performance Patterns', 'Octipas per-rule load']) {
          expect(html).toContain(needle)
        }
        const card = (title: string) => {
          const start = html.indexOf(title)
          return html.slice(start, html.indexOf('<div class="card">', start + title.length))
        }
        expect(card('Slow Queries')).not.toContain('Skipped: no data')
        expect(card('Code-Level Performance Patterns')).not.toContain('Skipped: no data')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('renders the Top Timers card from stored profiler data', async () => {
      const engine = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'render.mjs')
      const { renderReport } = await import(engine)
      const dir = mkdtempSync(join(tmpdir(), 'report-perf-timers-'))
      try {
        await renderReport({
          layout: 'perf',
          audience: 'dev',
          outDir: dir,
          data: {
            meta: { title: 'Timers', date: '2026-10-26' },
            verdict: 'v',
            scope: 'deep',
            urlSet: [],
            pages: [
              {
                label: 'a',
                profilerRoot: 10,
                profiler: [
                  { timer: 'magento->BLOCK->Foo::_toHtml', time: 1.2, avg: 1.2, count: 1 },
                  { timer: 'magento->tiny', time: 0.01, avg: 0.01, count: 1 },
                  { timer: 'magento->chatty', time: 0.01, avg: 0.001, count: 12 },
                ],
              },
              { label: 'b', profilerRoot: 1, profiler: [] },
            ],
            recommendations: [],
            coverageNote: 'n',
          },
        })
        const html = readFileSync(join(dir, 'report.html'), 'utf-8')
        expect(html).toContain('Top Timers')
        expect(html).toContain('Foo::_toHtml')
        expect(html).toContain('chatty')
        expect(html).not.toContain('tiny')
        expect(html).toContain('No timer past the threshold')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
