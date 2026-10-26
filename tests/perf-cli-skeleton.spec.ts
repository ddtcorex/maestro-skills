import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makeProject, perfCli, perfScripts, useEnv, type FakeProject } from './helpers/perf-harness'

const lastStatus = (stdout: string) => JSON.parse(stdout.trim().split('\n').pop() as string)

describe('perf-audit CLI skeleton', () => {
  let project: FakeProject | undefined
  afterEach(async () => {
    await project?.close()
    project = undefined
  })

  it('rejects an unknown subcommand with exit 2 and a status line', () => {
    const res = spawnSync('node', [perfCli, 'bogus'], { encoding: 'utf-8' })
    expect(res.status).toBe(2)
    expect(lastStatus(res.stdout)).toMatchObject({ ok: false })
  })

  it('names the missing field when the config lacks baseUrl', async () => {
    project = await makeProject()
    const bad = join(project.root, 'bad.json')
    writeFileSync(bad, JSON.stringify({ projectRoot: project.root, urlSet: [] }))
    const { loadConfig } = await import(join(perfScripts, 'lib', 'config.mjs'))
    expect(() => loadConfig(bad)).toThrow(/baseUrl/)
  })

  it('runs commands through govard sh and records them in the shim log', async () => {
    project = await makeProject()
    const restore = useEnv(project.env)
    try {
      const { govardSh } = await import(join(perfScripts, 'lib', 'govard.mjs'))
      const res = await govardSh(project.root, 'echo hello')
      expect(res.code).toBe(0)
      expect(res.stdout.trim()).toBe('hello')
      expect(project.shimLog()).toContain('sh: echo hello')
    } finally {
      restore()
    }
  })

  it('falls back to valkey when the redis service is unknown', async () => {
    project = await makeProject()
    const restore = useEnv({ ...project.env, PERF_SHIM_NO_REDIS: '1' })
    try {
      const { govardRedis } = await import(join(perfScripts, 'lib', 'govard.mjs'))
      const res = await govardRedis(project.root, ['-n', '1', 'FLUSHDB'])
      expect(res.code).toBe(0)
      expect(project.shimLog()).toEqual(['redis: -n 1 FLUSHDB', 'valkey: -n 1 FLUSHDB'])
    } finally {
      restore()
    }
  })
})
