import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { perfScripts } from './helpers/perf-harness'

const fixtures = join(__dirname, 'fixtures', 'perf', 'capture')
const lib = (name: string) => import(join(perfScripts, 'lib', `${name}.mjs`))

describe('query log parsing', () => {
  it('normalizes literals, IN lists and whitespace into one shape', async () => {
    const { normalizeSql } = await lib('querylog')
    expect(normalizeSql("SELECT * FROM t WHERE id IN (1, 2, 3) AND n = 'x'")).toBe('SELECT * FROM t WHERE id IN(?) AND n = ?')
    expect(normalizeSql('SELECT *\n  FROM tmp_select_42 WHERE a = 1.5')).toBe('SELECT * FROM tmp_select_N WHERE a = ?')
  })

  it('splits records by the record header only, even when SQL text looks like one', async () => {
    const { parseQueryLog } = await lib('querylog')
    const records = parseQueryLog(readFileSync(join(fixtures, 'pass1', 'home.db.log'), 'utf-8'))
    expect(records).toHaveLength(3)
    expect(records[2].sql).toContain('## not a header TIME: 9')
    expect(records[2].time).toBe(0.0005)
  })

  it('keeps a multi-line SQL whose lines start with ## or TIME:', async () => {
    const { parseQueryLog } = await lib('querylog')
    const text = "## 2026-10-26 00:00:00\n## 41 ## QUERY\nSQL: SELECT 'a\n## b\nTIME: c'\nAFF: 0\nTIME: 0.0300\n\n## 2026-10-26 00:00:01\n## 41 ## QUERY\nSQL: SELECT 1\nAFF: 0\nTIME: 0.0001\n\n"
    const records = parseQueryLog(text)
    expect(records).toHaveLength(2)
    expect(records[0].sql).toBe("SELECT 'a\n## b\nTIME: c'")
    expect(records[0].time).toBe(0.03)
  })
})

describe('query log as Magento writes it', () => {
  it('accepts the CRLF Magento writes after the date header', async () => {
    const { parseQueryLog } = await lib('querylog')
    // Magento\Framework\DB\Logger\File writes "## <date>\r\n" before each record.
    const text = '## 2026-10-26 08:54:17\r\n## 1823 ## CONNECT\nTIME: 0.0006\n\n## 2026-10-26 08:54:17\r\n## 1823 ## QUERY\nSQL: SET NAMES utf8\nAFF: 0\nTIME: 0.0001\n\n## 2026-10-26 08:54:17\r\n## 1823 ## QUERY\nSQL: SELECT 1\nAFF: 3\nTIME: 0.0003\n\n'
    const records = parseQueryLog(text)
    expect(records.map((r: { sql: string }) => r.sql)).toEqual(['SET NAMES utf8', 'SELECT 1'])
  })
})

describe('profiler parsing', () => {
  it('decodes the timer name from the title attribute', async () => {
    const { parseProfiler } = await lib('profiler')
    const rows = parseProfiler(readFileSync(join(fixtures, 'pass1', 'home.html'), 'utf-8'))
    expect(rows.map((r: { timer: string }) => r.timer)).toEqual(['magento', 'magento->Magento\\Foo->bar() > x "q"'])
    expect(rows[0]).toMatchObject({ time: 1.8, count: 1 })
  })
})

describe('caller attribution', () => {
  it('prefers the first app/code or third-party vendor frame', async () => {
    const { attributeCaller } = await lib('attribution')
    const trace = '#1 Magento\\Framework\\DB\\Adapter\\Pdo\\Mysql->query() called at [vendor/magento/framework/DB/Adapter/Pdo/Mysql.php:10]\n#2 Acme\\Catalog\\Model\\Stock->load() called at [app/code/Acme/Catalog/Model/Stock.php:42]'
    expect(attributeCaller(trace)).toEqual({ caller: 'app/code/Acme/Catalog/Model/Stock.php:42 (Acme\\Catalog\\Model\\Stock->load)', custom: true })
  })

  it('falls back to the first non-framework frame, then to ?', async () => {
    const { attributeCaller } = await lib('attribution')
    const core = '#1 Magento\\Framework\\X->a() called at [vendor/magento/framework/X.php:1]\n#2 Magento\\Catalog\\Y->b() called at [vendor/magento/module-catalog/Y.php:2]'
    expect(attributeCaller(core)).toEqual({ caller: 'vendor/magento/module-catalog/Y.php:2 (Magento\\Catalog\\Y->b)', custom: false })
    expect(attributeCaller('')).toEqual({ caller: '?', custom: false })
  })
})

describe('analyzeRun', () => {
  let runDir: string
  let data: any
  beforeAll(async () => {
    runDir = mkdtempSync(join(tmpdir(), 'perf-analyze-'))
    cpSync(fixtures, join(runDir, 'capture'), { recursive: true })
    const { analyzeRun } = await import(join(perfScripts, 'analyze.mjs'))
    const config = { baseUrl: 'https://example.test', urlSet: [{ label: 'home', uri: '/' }, { label: 'category_small', uri: '/sample-category.html' }] }
    analyzeRun(runDir, config)
    data = JSON.parse(readFileSync(join(runDir, 'audit-data.json'), 'utf-8'))
  })
  afterAll(() => rmSync(runDir, { recursive: true, force: true }))

  it('writes per-page counts, timings and versions', () => {
    expect(data.templateVersion).toBe(1)
    expect(typeof data.skillVersion).toBe('string')
    const home = data.pages.find((p: any) => p.label === 'home')
    expect(home).toMatchObject({ url: 'https://example.test/', uri: '/', http: 200, totalQueries: 3, pass2Queries: 3, traceQueries: 3, distinctShapes: 2, profilerRoot: 1.8, ttfbUncachedMs: 1900 })
    expect(home.shapes[0]).toMatchObject({ sql: 'SELECT * FROM t WHERE id IN(?)', count: 2 })
  })

  it('records the listing template path for category samples', () => {
    const cat = data.pages.find((p: any) => p.label === 'category_small')
    expect(cat.template).toBe('app/design/frontend/Acme/child/Magento_Catalog/templates/product/list.phtml')
    expect(data.urlSet.find((u: any) => u.label === 'category_small').template).toBe(cat.template)
  })

  it('counts pass 2 and trace queries from the logs, not the capture summary', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-analyze-recount-'))
    try {
      cpSync(fixtures, join(dir, 'capture'), { recursive: true })
      const csv = join(dir, 'capture', 'summary.csv')
      writeFileSync(csv, readFileSync(csv, 'utf-8').replace(/,\d+\n/g, ',0\n'))
      const { analyzeRun } = await import(join(perfScripts, 'analyze.mjs'))
      const data = analyzeRun(dir, { baseUrl: 'https://example.test', urlSet: [{ label: 'home', uri: '/' }] })
      expect(data.pages.find((p: any) => p.label === 'home')).toMatchObject({ totalQueries: 3, pass2Queries: 3, traceQueries: 3 })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags a page whose pass 1 and pass 2 counts differ', () => {
    expect(data.passMismatch).toEqual(['category_small'])
  })

  it('attributes traced shapes to their caller', () => {
    expect(data.attribution.home['SELECT * FROM t WHERE id IN(?)']).toEqual([['app/code/Acme/Catalog/Model/Stock.php:42 (Acme\\Catalog\\Model\\Stock->load)', 2]])
  })
})

describe('analyze subcommand', () => {
  it('writes audit-data.json and prints an ok status', async () => {
    const { spawnSync } = await import('node:child_process')
    const { writeFileSync } = await import('node:fs')
    const { perfCli } = await import('./helpers/perf-harness')
    const runDir = mkdtempSync(join(tmpdir(), 'perf-analyze-cli-'))
    try {
      cpSync(fixtures, join(runDir, 'capture'), { recursive: true })
      const config = join(runDir, 'config.json')
      writeFileSync(config, JSON.stringify({ projectRoot: runDir, baseUrl: 'https://example.test', urlSet: [{ label: 'home', uri: '/' }] }))
      const res = spawnSync('node', [perfCli, 'analyze', config, '--run', runDir], { encoding: 'utf-8' })
      expect(res.status).toBe(0)
      expect(JSON.parse(res.stdout.trim().split('\n').pop() as string)).toEqual({ ok: true, stage: 'analyze', outputs: [join(runDir, 'audit-data.json')] })
    } finally {
      rmSync(runDir, { recursive: true, force: true })
    }
  })
})
