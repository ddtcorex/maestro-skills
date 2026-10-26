import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfScripts, useEnv, type FakeProject } from './helpers/perf-harness'

const candidatesPath = join(__dirname, 'fixtures', 'perf', 'discover', 'candidates.json')
const candidates = () => JSON.parse(readFileSync(candidatesPath, 'utf-8'))
const lib = async () => import(join(perfScripts, 'discover.mjs'))

describe('pickUrlSet', () => {
  it('picks home, three category sizes and three products of distinct types', async () => {
    const { pickUrlSet } = await lib()
    expect(pickUrlSet(candidates())).toEqual([
      { label: 'home', uri: '/' },
      { label: 'category_small', uri: '/small.html', productCount: 4 },
      { label: 'category_medium', uri: '/mid2.html', productCount: 75 },
      { label: 'category_large', uri: '/big.html', productCount: 900 },
      { label: 'product_1', uri: '/s1.html' },
      { label: 'product_2', uri: '/c1.html?x=1' },
      { label: 'product_3', uri: '/b1.html' },
    ])
  })
})

describe('discover', () => {
  let project: FakeProject
  let restoreEnv: () => void
  let out: string
  beforeEach(async () => {
    project = await makeProject()
    out = join(project.root, 'discovered.json')
    restoreEnv = useEnv({ ...project.env, PERF_FAKE_PHP_OUT: candidatesPath })
  })
  afterEach(async () => {
    restoreEnv()
    await project.close()
  })

  it('writes the frozen config with theme overrides, trace pages and an invalidation SKU', async () => {
    const { discover } = await lib()
    await discover(project.root, 'https://example.test', out, {})
    const config = JSON.parse(readFileSync(out, 'utf-8'))
    expect(config).toMatchObject({ projectRoot: project.root, baseUrl: 'https://example.test', themeOverrides: ['Acme/child'], trace: ['home', 'category_large', 'product_1'], invalidation: { sku: 'S-1' } })
    expect(config.urlSet).toHaveLength(7)
  })

  it('refuses to overwrite an existing config without --refresh', async () => {
    writeFileSync(out, '{"frozen":true}')
    const { discover } = await lib()
    await expect(discover(project.root, 'https://example.test', out, {})).rejects.toMatchObject({ reason: expect.stringContaining('--refresh') })
    expect(readFileSync(out, 'utf-8')).toBe('{"frozen":true}')
  })

  it('rewrites the config with --refresh', async () => {
    writeFileSync(out, '{"frozen":true}')
    const { discover } = await lib()
    await discover(project.root, 'https://example.test', out, { refresh: true })
    expect(existsSync(out) && JSON.parse(readFileSync(out, 'utf-8')).urlSet).toHaveLength(7)
  })
})
