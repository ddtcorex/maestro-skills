import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeProject, perfScripts, useEnv, type FakeProject } from './helpers/perf-harness'

const lib = async () => import(join(perfScripts, 'switch.mjs'))
const REDIS = 'Magento\\Framework\\Cache\\Backend\\Redis'

describe('cacheTargets', () => {
  const env = (frontend: Record<string, unknown>, sessionDb: string | null = '0') => ({
    cache: { frontend },
    session: sessionDb === null ? { save: 'files' } : { save: 'redis', redis: { database: sessionDb } },
  })
  const redis = (db: string) => ({ backend: REDIS, backend_options: { database: db } })

  it('flushes the default and page cache databases, never the session one', async () => {
    const { cacheTargets } = await lib()
    expect(cacheTargets(env({ default: redis('1'), page_cache: redis('2') }))).toEqual({ kind: 'redis', databases: [1, 2], sessionDb: 0 })
  })

  it('flushes only the default database when page_cache is absent', async () => {
    const { cacheTargets } = await lib()
    expect(cacheTargets(env({ default: redis('1') })).databases).toEqual([1])
  })

  it('flushes a shared database once', async () => {
    const { cacheTargets } = await lib()
    expect(cacheTargets(env({ default: redis('1'), page_cache: redis('1') })).databases).toEqual([1])
  })

  it('drops a cache database that is also the session database', async () => {
    const { cacheTargets } = await lib()
    expect(cacheTargets(env({ default: redis('0'), page_cache: redis('2') })).databases).toEqual([2])
  })

  it('reports a file backend when no Redis cache is configured', async () => {
    const { cacheTargets } = await lib()
    expect(cacheTargets(env({}, null))).toEqual({ kind: 'file', databases: [], sessionDb: null })
  })
})

describe('enabledInConfig', () => {
  it('reads multi-segment module names enabled with => 1, skipping disabled ones', async () => {
    const { enabledInConfig } = await lib()
    const root = mkdtempSync(join(tmpdir(), 'perf-modules-'))
    try {
      mkdirSync(join(root, 'app', 'etc'), { recursive: true })
      writeFileSync(join(root, 'app', 'etc', 'config.php'), "<?php return ['modules' => ['Acme_Foo' => 1, 'Acme_Bar_Baz' => 1, 'Acme_Off' => 0]];")
      expect(enabledInConfig(root)).toEqual(['Acme_Foo', 'Acme_Bar_Baz'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('switchBranch', () => {
  let project: FakeProject
  let origin: string
  let restoreEnv: () => void
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf-8' })
  const commitFile = (path: string, content: string, message: string) => {
    mkdirSync(join(project.root, path, '..'), { recursive: true })
    writeFileSync(join(project.root, path), content)
    git(project.root, 'add', path)
    git(project.root, 'commit', '-q', '-m', message)
  }
  const config = () => ({ projectRoot: project.root, baseUrl: project.server.url, urlSet: [{ label: 'home', uri: '/' }], trace: [] })
  const cacheJson = (frontend: Record<string, unknown>) => {
    const out = join(origin, '..', `cache-${Math.random()}.json`)
    writeFileSync(out, JSON.stringify({ cache: { frontend }, session: { save: 'redis', redis: { database: '0' } } }))
    return out
  }

  beforeEach(async () => {
    project = await makeProject()
    const base = mkdtempSync(join(tmpdir(), 'perf-switch-'))
    origin = join(base, 'origin.git')
    git(base, 'init', '-q', '--bare', origin)
    writeFileSync(join(project.root, '.gitignore'), '.shim.log\nvar/\nbin/\nperf-audit.config.json\n')
    git(project.root, 'init', '-q')
    git(project.root, 'remote', 'add', 'origin', origin)
    commitFile('composer.lock', 'lock-a', 'base')
    commitFile('app/etc/config.php', "<?php return ['modules' => ['Acme_Foo' => 1]];", 'config')
    git(project.root, 'push', '-q', 'origin', 'main')
    git(project.root, 'checkout', '-q', '-b', 'feature')
    commitFile('composer.lock', 'lock-b', 'lock change')
    commitFile('app/etc/config.php', "<?php return ['modules' => ['Acme_Foo' => 1, 'Acme_Bar' => 1, 'Acme_Off' => 0]];", 'add module')
    git(project.root, 'push', '-q', 'origin', 'feature')
    git(project.root, 'checkout', '-q', 'main')
    project.server.setPage('/', { status: 200 })
    restoreEnv = useEnv({ ...project.env, PERF_FAKE_MODULES: 'Acme_Foo Acme_Bar', PERF_FAKE_PHP_OUT: cacheJson({ default: { backend: REDIS, backend_options: { database: '1' } }, page_cache: { backend: REDIS, backend_options: { database: '2' } } }) })
  })
  afterEach(async () => {
    restoreEnv()
    await project.close()
    rmSync(join(origin, '..'), { recursive: true, force: true })
  })

  it('runs every step in order and installs composer when the lock changes', async () => {
    const { switchBranch } = await lib()
    const result = await switchBranch(config(), 'feature')
    expect(result.steps).toEqual(['fetch', 'checkout', 'pull', 'composer install', 'clear generated', 'flush cache', 'setup:upgrade', 'module check', 'url check'])
    expect(git(project.root, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('feature')
    const log = project.shimLog()
    const at = (needle: string) => log.findIndex((l) => l.includes(needle))
    expect(at('composer install')).toBeLessThan(at('rm -rf generated/code generated/metadata'))
    expect(at('rm -rf generated/code')).toBeLessThan(at('redis: -n 1 FLUSHDB'))
    expect(log).toContain('redis: -n 2 FLUSHDB')
    expect(log.some((l) => l === 'redis: -n 0 FLUSHDB')).toBe(false)
    expect(at('redis: -n 2 FLUSHDB')).toBeLessThan(at('magento: setup:upgrade'))
  })

  it('skips composer install when the lock is unchanged', async () => {
    const { switchBranch } = await lib()
    await switchBranch(config(), 'feature')
    const restore = useEnv({ PERF_FAKE_MODULES: 'Acme_Foo' })
    try {
      git(project.root, 'checkout', '-q', '-b', 'same', 'origin/main')
      git(project.root, 'push', '-q', 'origin', 'same')
      git(project.root, 'checkout', '-q', 'main')
      writeFileSync(project.logPath, '')
      const result = await switchBranch(config(), 'same')
      expect(result.steps).not.toContain('composer install')
    } finally {
      restore()
    }
  })

  it('clears the file cache directories instead of Redis on a file backend', async () => {
    const restore = useEnv({ PERF_FAKE_PHP_OUT: cacheJson({}) })
    try {
      mkdirSync(join(project.root, 'var', 'cache', 'mage--1'), { recursive: true })
      mkdirSync(join(project.root, 'var', 'page_cache'), { recursive: true })
      const { switchBranch } = await lib()
      await switchBranch(config(), 'feature')
      expect(existsSync(join(project.root, 'var', 'cache'))).toBe(false)
      expect(existsSync(join(project.root, 'var', 'page_cache'))).toBe(false)
      expect(project.shimLog().some((l) => l.startsWith('redis:'))).toBe(false)
    } finally {
      restore()
    }
  })

  it('stops with a closed reason when the local branch diverged', async () => {
    git(project.root, 'checkout', '-q', 'feature')
    commitFile('local.txt', 'local', 'local only')
    git(project.root, 'checkout', '-q', 'main')
    const other = mkdtempSync(join(tmpdir(), 'perf-switch-other-'))
    try {
      git(other, 'clone', '-q', '-b', 'feature', origin, 'w')
      const w = join(other, 'w')
      writeFileSync(join(w, 'remote.txt'), 'remote')
      git(w, 'add', 'remote.txt')
      git(w, 'commit', '-q', '-m', 'remote only')
      git(w, 'push', '-q', 'origin', 'feature')
      const { switchBranch } = await lib()
      await expect(switchBranch(config(), 'feature')).rejects.toMatchObject({ reason: 'Skipped: local diverged' })
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })

  it('fails naming the modules enabled in config.php but not in Magento', async () => {
    const restore = useEnv({ PERF_FAKE_MODULES: 'Acme_Foo' })
    try {
      const { switchBranch } = await lib()
      await expect(switchBranch(config(), 'feature')).rejects.toMatchObject({ reason: expect.stringContaining('Acme_Bar') })
    } finally {
      restore()
    }
  })

  it('fails listing a frozen URL that does not return 200', async () => {
    project.server.setPage('/', { status: 500 })
    const { switchBranch } = await lib()
    await expect(switchBranch(config(), 'feature')).rejects.toMatchObject({ reason: expect.stringContaining('/ (500)') })
  })
})
