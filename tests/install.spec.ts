import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_SKILLS, repoRoot } from './helpers/skills'

// The installer pulls its cache clone; a clone of this checkout makes that pull local.
function run(args: string[], home = mkdtempSync(join(tmpdir(), 'maestro-install-'))) {
  const cache = join(home, 'cache')
  if (!existsSync(cache)) execFileSync('git', ['clone', '-q', repoRoot, cache])
  // Overlay the working tree so uncommitted plugins are tested too.
  cpSync(join(repoRoot, 'plugins'), join(cache, 'plugins'), { recursive: true })
  const res = spawnSync('bash', [join(repoRoot, 'install.sh'), '-y', '--scope', 'personal', '--target', 'opencode', ...args], {
    env: { ...process.env, HOME: home, MAESTRO_SKILLS_HOME: cache },
    encoding: 'utf8',
  })
  const dir = join(home, '.config', 'opencode', 'skills')
  let linked: string[] = []
  try { linked = readdirSync(dir).sort() } catch { /* nothing linked */ }
  return { status: res.status, stderr: res.stderr, linked, home, cache, dir }
}

describe('install.sh areas', () => {
  it('no flag installs every skill of every area', () => {
    const { status, linked } = run([])
    expect(status).toBe(0)
    expect(linked).toEqual([...ALL_SKILLS].sort())
  })

  it('--area maestro-php installs only php-dev-core', () => {
    const { status, linked } = run(['--area', 'maestro-php'])
    expect(status).toBe(0)
    expect(linked).toEqual(['php-dev-core'])
  })

  it('--area nope exits non-zero and names the area', () => {
    const { status, stderr } = run(['--area', 'nope'])
    expect(status).not.toBe(0)
    expect(stderr).toContain('unknown area: nope')
  })

  it('a stale link from a skill that no longer ships is pruned on install and uninstall', () => {
    const first = run(['--area', 'maestro-php'])
    // A link the old flat layout created, now dangling, still recorded in the manifest.
    const stale = join(first.dir, 'brainstorming')
    symlinkSync(join(first.cache, 'skills', 'brainstorming'), stale)
    appendFileSync(join(first.cache, '.manifest'), `${stale}\n`)
    run(['--area', 'maestro-php'], first.home)
    expect(() => lstatSync(stale)).toThrow()
    symlinkSync(join(first.cache, 'skills', 'brainstorming'), stale)
    appendFileSync(join(first.cache, '.manifest'), `${stale}\n`)
    const res = spawnSync('bash', [join(repoRoot, 'install.sh'), '--uninstall'], {
      env: { ...process.env, HOME: first.home, MAESTRO_SKILLS_HOME: first.cache }, encoding: 'utf8',
    })
    expect(res.status).toBe(0)
    expect(() => lstatSync(stale)).toThrow()
    expect(readdirSync(first.dir)).toEqual([])
  })
})
