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
  'timers_badge',
  'timers_status',
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
      expect(html).not.toContain('Top Timers')
      expect(html).not.toContain('Code-Level Performance Patterns')
      expect(html).not.toContain('DB slow')
      expect(html).not.toContain('(audit')
    })
  })
})
