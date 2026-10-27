import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfCli, perfScripts, shimBin, type FakeProject } from './helpers/perf-harness'

// Async on purpose: the fake HTTP server lives in this process, so a
// blocking spawn would deadlock the CLI waiting for it.
const cli = async (args: string[], env: NodeJS.ProcessEnv) => {
  try {
    return (await promisify(execFile)('node', [perfCli, ...args], { encoding: 'utf-8', env })).stdout
  } catch (err: any) {
    return err.stdout as string
  }
}
const lastStatus = (stdout: string) => JSON.parse(stdout.trim().split('\n').pop() as string)
const record = (sql: string) => `## 2026-10-26 00:00:00\n## 41 ## QUERY\nSQL: ${sql}\nAFF: 0\nTIME: 0.0010\n\n`

describe('runAudit pipeline', () => {
  it('runs the stages in order and adds switch only with a branch', async () => {
    const { runAudit } = await import(join(perfScripts, 'run.mjs'))
    const calls: string[] = []
    const stage = (name: string) => async () => { calls.push(name) }
    const stages = Object.fromEntries(['switch', 'capture', 'analyze', 'cwv', 'invalidate', 'render'].map((n) => [n, stage(n)]))
    const out = mkdtempSync(join(tmpdir(), 'perf-run-'))
    try {
      await runAudit({ urlSet: [] }, { out, branch: 'feature/x' }, stages)
      expect(calls).toEqual(['switch', 'capture', 'analyze', 'cwv', 'invalidate', 'render'])
      calls.length = 0
      await runAudit({ urlSet: [] }, { out, runName: 'base' }, stages)
      expect(calls).toEqual(['capture', 'analyze', 'cwv', 'invalidate', 'render'])
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('stops at the first closed reason', async () => {
    const { runAudit } = await import(join(perfScripts, 'run.mjs'))
    const { ClosedReason } = await import(join(perfScripts, 'lib', 'status.mjs'))
    const calls: string[] = []
    const stages = {
      capture: async () => { calls.push('capture') },
      analyze: async () => { calls.push('analyze') },
      cwv: async () => { throw new ClosedReason('cwv', 'Skipped: no FPC HIT') },
      invalidate: async () => { calls.push('invalidate') },
      render: async () => { calls.push('render') },
    }
    const out = mkdtempSync(join(tmpdir(), 'perf-run-'))
    try {
      await expect(runAudit({ urlSet: [] }, { out, runName: 'x' }, stages)).rejects.toMatchObject({ reason: 'Skipped: no FPC HIT' })
      expect(calls).toEqual(['capture', 'analyze'])
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('names the run directory after the branch slug', async () => {
    const { runDirFor } = await import(join(perfScripts, 'run.mjs'))
    expect(runDirFor('/out', 'feature/Fix stock')).toBe('/out/feature-fix-stock')
  })
})

describe('run subcommand end to end', () => {
  let project: FakeProject
  let out: string
  let env: NodeJS.ProcessEnv
  beforeEach(async () => {
    project = await makeProject({ invalidation: { sku: 'ACME-1' }, themeOverrides: [] })
    out = mkdtempSync(join(tmpdir(), 'perf-run-out-'))
    const script = join(out, 'lh.json')
    writeFileSync(script, JSON.stringify([{ score: 80, lcp: 1000, headers: { 'X-Magento-Cache-Debug': 'HIT' } }]))
    project.server.setPage('/', { status: 200, dbLog: record('SELECT 1') + record('SELECT 2'), headers: { 'X-Magento-Cache-Debug': 'HIT' } })
    env = { ...project.env, LIGHTHOUSE_CLI: join(shimBin, 'lighthouse'), PERF_LH_SCRIPT: script }
  })
  afterEach(async () => {
    await project.close()
    rmSync(out, { recursive: true, force: true })
  })

  it('produces the report and lets render rerun alone without touching the capture', async () => {
    const run = await cli(['run', project.configPath, '--out', out, '--run-name', 'base', '--scope', 'quick'], env)
    expect(lastStatus(run)).toMatchObject({ ok: true, stage: 'run' })
    const runDir = join(out, 'base')
    for (const file of ['capture/summary.csv', 'audit-data.json', 'cwv/cwv.json', 'invalidation.json', 'report.html', 'findings.json']) {
      expect(existsSync(join(runDir, file)), file).toBe(true)
    }
    const captured = statSync(join(runDir, 'capture', 'pass1', 'home.db.log')).mtimeMs
    const render = await cli(['render', project.configPath, '--run', runDir], env)
    expect(lastStatus(render)).toMatchObject({ ok: true, stage: 'render' })
    expect(statSync(join(runDir, 'capture', 'pass1', 'home.db.log')).mtimeMs).toBe(captured)
  })
})
