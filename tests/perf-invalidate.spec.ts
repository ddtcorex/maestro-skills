import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfScripts, useEnv, type FakeProject } from './helpers/perf-harness'

const HIT = { 'X-Magento-Cache-Debug': 'HIT' }
const MISS = { 'X-Magento-Cache-Debug': 'MISS' }

function tree(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(root, path))
    }
  }
  walk(root)
  return out.filter((p) => p !== '.shim.log').sort()
}

describe('invalidate stage', () => {
  let project: FakeProject
  let runDir: string
  let stdinLog: string
  let restoreEnv: () => void
  const config = (extra: Record<string, unknown> = { invalidation: { sku: "ACME'1" } }) => ({
    projectRoot: project.root,
    baseUrl: project.server.url,
    urlSet: [{ label: 'home', uri: '/' }, { label: 'product_1', uri: '/p.html' }],
    trace: [],
    ...extra,
  })
  const invalidate = async (cfg: any) => (await import(join(perfScripts, 'invalidate.mjs'))).invalidate(cfg, runDir)

  beforeEach(async () => {
    project = await makeProject()
    runDir = mkdtempSync(join(tmpdir(), 'perf-invalidate-'))
    stdinLog = join(runDir, 'php-stdin.log')
    restoreEnv = useEnv({ ...project.env, PERF_PHP_STDIN_LOG: stdinLog })
    project.server.setPage('/', { status: 200, headerSeq: [MISS, HIT, HIT] })
    project.server.setPage('/p.html', { status: 200, headerSeq: [MISS, HIT, MISS] })
  })
  afterEach(async () => {
    restoreEnv()
    await project.close()
    rmSync(runDir, { recursive: true, force: true })
  })

  it('pipes a repository save in the adminhtml area with the SKU as an argument', async () => {
    await invalidate(config())
    const php = readFileSync(stdinLog, 'utf-8')
    for (const needle of ["setAreaCode('adminhtml')", 'setHasDataChanges(true)', 'ProductRepositoryInterface', '$argv[1]']) expect(php).toContain(needle)
    expect(php).not.toContain('ACME')
    expect(project.shimLog()).toContain("php: -- ACME'1")
  })

  it('writes nothing under the project root', async () => {
    const before = tree(project.root)
    await invalidate(config())
    expect(tree(project.root)).toEqual(before)
  })

  it('lists the pages that were HIT before the save and not after', async () => {
    await invalidate(config())
    const result = JSON.parse(readFileSync(join(runDir, 'invalidation.json'), 'utf-8'))
    expect(result).toMatchObject({
      sku: "ACME'1",
      method: 'save via product repository, adminhtml area',
      before: { home: true, product_1: true },
      after: { home: true, product_1: false },
      invalidated: ['product_1'],
    })
  })

  it('stops with a closed reason when no SKU is configured', async () => {
    await expect(invalidate(config({}))).rejects.toMatchObject({ reason: 'Skipped: invalidation sku missing' })
  })
})
