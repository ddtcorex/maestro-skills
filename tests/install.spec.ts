import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_SKILLS, repoRoot } from './helpers/skills'

// The installer pulls its cache clone; a clone of this checkout makes that pull local.
function run(args: string[]) {
  const home = mkdtempSync(join(tmpdir(), 'maestro-install-'))
  const cache = join(home, 'cache')
  execFileSync('git', ['clone', '-q', repoRoot, cache])
  // CI checks out a detached merge ref with no local branch, so the clone is detached too;
  // give it a branch that pulls from itself, so the installer's `git pull --ff-only` is a no-op.
  execFileSync('git', ['-C', cache, 'checkout', '-q', '--detach'])
  execFileSync('git', ['-C', cache, 'checkout', '-q', '-B', 'install-test'])
  execFileSync('git', ['-C', cache, 'config', 'branch.install-test.remote', '.'])
  execFileSync('git', ['-C', cache, 'config', 'branch.install-test.merge', 'refs/heads/install-test'])
  const res = spawnSync('bash', [join(repoRoot, 'install.sh'), '-y', '--scope', 'personal', '--target', 'opencode', ...args], {
    env: { ...process.env, HOME: home, MAESTRO_SKILLS_HOME: cache },
    encoding: 'utf8',
  })
  const dir = join(home, '.config', 'opencode', 'skills')
  let linked: string[] = []
  try { linked = readdirSync(dir).sort() } catch { /* nothing linked */ }
  return { status: res.status, stderr: res.stderr, linked }
}

describe('install.sh areas', () => {
  it('no flag installs every skill of every area', () => {
    const { status, stderr, linked } = run([])
    expect(status, stderr).toBe(0)
    expect(linked).toEqual([...ALL_SKILLS].sort())
  })

  it('--area maestro-php installs only php-dev-core', () => {
    const { status, stderr, linked } = run(['--area', 'maestro-php'])
    expect(status, stderr).toBe(0)
    expect(linked).toEqual(['php-dev-core'])
  })

  it('--area nope exits non-zero and names the area', () => {
    const { status, stderr } = run(['--area', 'nope'])
    expect(status).not.toBe(0)
    expect(stderr).toContain('unknown area: nope')
  })
})
