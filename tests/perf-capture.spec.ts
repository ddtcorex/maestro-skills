import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfScripts, useEnv, type FakeProject } from './helpers/perf-harness'

const record = (sql: string) => `## 2026-10-26 00:00:00\n## 41 ## QUERY\nSQL: ${sql}\nAFF: 0\nTIME: 0.0010\n\n`
const RESTORE = ['cache:enable full_page block_html layout', 'cache:flush', 'dev:profiler:disable', 'dev:query-log:disable']

describe('capture stage', () => {
  let project: FakeProject
  let runDir: string
  let restoreEnv: () => void
  const capture = async (config: any, scope = 'deep') => {
    const { capture } = await import(join(perfScripts, 'capture.mjs'))
    return capture(config, runDir, { scope })
  }
  const magentoCalls = () => project.shimLog().filter((l) => l.startsWith('magento: ')).map((l) => l.slice(9))
  const config = (extra: Record<string, unknown> = {}) => ({
    projectRoot: project.root,
    baseUrl: project.server.url,
    urlSet: [
      { label: 'home', uri: '/' },
      { label: 'category_small', uri: '/c.html' },
      { label: 'category_medium', uri: '/m.html' },
      { label: 'product_1', uri: '/p.html' },
    ],
    trace: ['home'],
    ...extra,
  })

  beforeEach(async () => {
    project = await makeProject()
    restoreEnv = useEnv(project.env)
    runDir = mkdtempSync(join(tmpdir(), 'perf-capture-'))
    for (const uri of ['/', '/c.html', '/m.html', '/p.html']) {
      project.server.setPage(uri, { status: 200, html: '<html>ok</html>', dbLog: record('SELECT 1') + record('SELECT 2') })
    }
  })
  afterEach(async () => {
    restoreEnv()
    await project.close()
    rmSync(runDir, { recursive: true, force: true })
  })

  it('deep runs pass 1, pass 2 and the trace pass on the trace labels only', async () => {
    await capture(config())
    const summary = readFileSync(join(runDir, 'capture', 'summary.csv'), 'utf-8').trim().split('\n')
    expect(summary[0]).toBe('pass,label,uri,http,timeTotal,ttfb,queries')
    const passes = summary.slice(1).map((l) => l.split(',').slice(0, 2).join(':'))
    expect(passes.filter((p) => p.startsWith('pass1:'))).toHaveLength(4)
    expect(passes.filter((p) => p.startsWith('pass2:'))).toHaveLength(4)
    expect(passes.filter((p) => p.startsWith('trace:'))).toEqual(['trace:home'])
    expect(readFileSync(join(runDir, 'capture', 'pass1', 'home.db.log'), 'utf-8')).toContain('SELECT 2')
    expect(magentoCalls()).toContain('dev:query-log:enable --include-all-queries=true --include-call-stack=false --query-time-threshold=0')
    expect(magentoCalls()).toContain('dev:query-log:enable --include-all-queries=true --include-call-stack=true --query-time-threshold=0')
  })

  it('quick runs pass 1 only on the first three pages with threshold 1', async () => {
    await capture(config(), 'quick')
    const rows = readFileSync(join(runDir, 'capture', 'summary.csv'), 'utf-8').trim().split('\n').slice(1)
    expect(rows.map((l) => l.split(',').slice(0, 2).join(':'))).toEqual(['pass1:home', 'pass1:category_small', 'pass1:category_medium'])
    expect(magentoCalls()).toContain('dev:query-log:enable --include-all-queries=true --include-call-stack=false --query-time-threshold=1')
  })

  it('stops with a closed reason and touches no cache when the lock is held', async () => {
    mkdirSync(join(project.root, 'var', 'debug', '.performance-audit.lock'))
    await expect(capture(config())).rejects.toMatchObject({ reason: 'Skipped: query-log capture already owned' })
    expect(magentoCalls().some((c) => c.startsWith('cache:disable'))).toBe(false)
  })

  it('restores caches, profiler and query log and releases the lock after success', async () => {
    await capture(config())
    expect(magentoCalls().slice(-4)).toEqual(RESTORE)
    expect(existsSync(join(project.root, 'var', 'debug', '.performance-audit.lock'))).toBe(false)
  })

  it('restores the same way after a failure mid-run', async () => {
    project.server.setPage('/m.html', { status: 200, destroy: true })
    await expect(capture(config())).rejects.toThrow()
    expect(magentoCalls().slice(-4)).toEqual(RESTORE)
    expect(existsSync(join(project.root, 'var', 'debug', '.performance-audit.lock'))).toBe(false)
  })

  it('records a redirect with its own status and never follows it', async () => {
    project.server.setPage('/c.html', { status: 301, headers: { location: '/c.html/' }, dbLog: record('SELECT 3') })
    await capture(config(), 'quick')
    const row = readFileSync(join(runDir, 'capture', 'summary.csv'), 'utf-8').split('\n').find((l) => l.startsWith('pass1,category_small'))
    expect(row?.split(',')[3]).toBe('301')
    expect(project.server.requests).not.toContain('/c.html/')
  })

  it('records a positive time to first byte and the query count', async () => {
    await capture(config(), 'quick')
    const row = readFileSync(join(runDir, 'capture', 'summary.csv'), 'utf-8').split('\n')[1].split(',')
    expect(Number(row[5])).toBeGreaterThan(0)
    expect(row[6]).toBe('2')
  })
})
