import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfScripts, shimBin, useEnv, type FakeProject } from './helpers/perf-harness'

const HIT = { 'X-Magento-Cache-Debug': 'HIT' }
const MISS = { 'X-Magento-Cache-Debug': 'MISS' }
const run = (score: number, lcp: number, headers: Record<string, string> = HIT) => ({ score, lcp, cls: 0.01, ttfb: 80, headers })

describe('lighthouse helpers', () => {
  it('reads the HIT signal from the document response headers', async () => {
    const { hitSignal } = await import(join(perfScripts, 'lib', 'lighthouse.mjs'))
    const doc = (headers: Record<string, string>) => [{ method: 'Network.responseReceived', params: { type: 'Document', response: { url: 'https://example.test/', headers } } }]
    expect(hitSignal(doc({ 'X-Magento-Cache-Debug': 'HIT' }), 'https://example.test/')).toEqual({ hit: true, source: 'x-magento-cache-debug' })
    expect(hitSignal(doc({ 'X-Magento-Cache-Debug': 'MISS' }), 'https://example.test/')).toEqual({ hit: false, source: 'x-magento-cache-debug' })
    expect(hitSignal(doc({ 'X-Cache': 'HIT' }), 'https://example.test/')).toEqual({ hit: true, source: 'x-cache' })
    expect(hitSignal(doc({ Age: '12' }), 'https://example.test/')).toEqual({ hit: true, source: 'age' })
    expect(hitSignal(doc({}), 'https://example.test/')).toEqual({ hit: false, source: 'none' })
    expect(hitSignal([], 'https://example.test/')).toEqual({ hit: null, source: null })
  })

  it('takes the middle value as the median', async () => {
    const { median } = await import(join(perfScripts, 'lib', 'lighthouse.mjs'))
    expect(median([64, 48, 71])).toBe(64)
    expect(median([5])).toBe(5)
  })

  it('resolves the CLI from LIGHTHOUSE_CLI, then PATH, else null', async () => {
    const { resolveLighthouse } = await import(join(perfScripts, 'lib', 'lighthouse.mjs'))
    expect(resolveLighthouse({ LIGHTHOUSE_CLI: join(shimBin, 'lighthouse'), PATH: '/nowhere' })).toBe(join(shimBin, 'lighthouse'))
    expect(resolveLighthouse({ PATH: shimBin, PERF_AUDIT_NPM_ROOT: '/nowhere' })).toBe(join(shimBin, 'lighthouse'))
    expect(resolveLighthouse({ PATH: '/nowhere', PERF_AUDIT_NPM_ROOT: '/nowhere' })).toBeNull()
  })
})

describe('cwv stage', () => {
  let project: FakeProject
  let runDir: string
  let restoreEnv: () => void
  let script: string
  let argvLog: string
  const setRuns = (runs: unknown[]) => writeFileSync(script, JSON.stringify(runs))
  const config = (labels = ['home']) => ({ projectRoot: project.root, baseUrl: project.server.url, urlSet: labels.map((l) => ({ label: l, uri: `/${l}` })), trace: [] })
  const cwv = async (cfg: any, scope = 'deep') => (await import(join(perfScripts, 'cwv.mjs'))).cwv(cfg, runDir, { scope })
  const result = () => JSON.parse(readFileSync(join(runDir, 'cwv', 'cwv.json'), 'utf-8'))

  beforeEach(async () => {
    project = await makeProject()
    runDir = mkdtempSync(join(tmpdir(), 'perf-cwv-'))
    script = join(runDir, 'lh-script.json')
    argvLog = join(runDir, 'lh-argv.log')
    restoreEnv = useEnv({ ...project.env, PERF_LH_SCRIPT: script, PERF_LH_ARGV_LOG: argvLog, LIGHTHOUSE_CLI: join(shimBin, 'lighthouse') })
  })
  afterEach(async () => {
    restoreEnv()
    await project.close()
    rmSync(runDir, { recursive: true, force: true })
  })

  it('runs Lighthouse warm with devtools throttling and saved assets', async () => {
    setRuns([run(70, 1200), run(64, 1300), run(48, 1500)])
    await cwv(config())
    const argv = JSON.parse(readFileSync(argvLog, 'utf-8').split('\n')[0])
    for (const flag of ['--preset=desktop', '--throttling-method=devtools', '--save-assets', '--output=json']) expect(argv).toContain(flag)
    expect(project.server.requests).toContain('/home')
  })

  it('keeps the median and spread of three runs on deep', async () => {
    setRuns([run(70, 1200), run(64, 1300), run(48, 1500)])
    await cwv(config())
    expect(result().home).toMatchObject({ median: { score: 64, lcpMs: 1300 }, spread: { score: 22, lcpMs: 300 }, hitSource: 'x-magento-cache-debug' })
    expect(result().home.runs).toHaveLength(3)
  })

  it('runs once on quick and marks the spread as skipped', async () => {
    setRuns([run(70, 1200)])
    await cwv(config(), 'quick')
    expect(result().home).toMatchObject({ median: { score: 70 }, spread: 'Skipped: quick' })
  })

  it('discards a miss, retries once, and keeps the HIT run', async () => {
    setRuns([run(10, 9000, MISS), run(70, 1200)])
    await cwv(config(), 'quick')
    expect(result().home).toMatchObject({ median: { score: 70 } })
  })

  it('skips the page after two misses in a row', async () => {
    setRuns([run(10, 9000, MISS), run(11, 9000, MISS)])
    await cwv(config(), 'quick')
    expect(result().home).toEqual({ skipped: 'Skipped: no FPC HIT' })
  })

  it('counts a run with no document response as a miss, never as a score', async () => {
    setRuns([{ ...run(90, 900), noDocument: true }, { ...run(91, 900), noDocument: true }])
    await cwv(config(), 'quick')
    expect(result().home).toEqual({ skipped: 'Skipped: no FPC HIT' })
  })

  it('reports no HIT signal when no run carries a cache header', async () => {
    setRuns([run(70, 1200, {}), run(71, 1200, {})])
    await cwv(config(), 'quick')
    expect(result().home).toEqual({ skipped: 'Skipped: no HIT signal (production mode, built-in FPC)' })
  })

  it('skips the warm group when the full page cache is disabled', async () => {
    setRuns([run(70, 1200)])
    const restore = useEnv({ PERF_FAKE_CACHE_STATUS: 'full_page: 0' })
    try {
      await expect(cwv(config(), 'quick')).rejects.toMatchObject({ reason: 'Skipped: page cache disabled' })
    } finally {
      restore()
    }
  })

  it('stops with a closed reason and an install hint when no CLI resolves', async () => {
    const restore = useEnv({ LIGHTHOUSE_CLI: '', PATH: '/usr/bin:/bin', PERF_AUDIT_NPM_ROOT: '/nowhere' })
    try {
      await expect(cwv(config())).rejects.toMatchObject({ reason: expect.stringMatching(/^Skipped: Lighthouse CLI not found.*npm install -g @lhci\/cli/) })
    } finally {
      restore()
    }
  })
})
