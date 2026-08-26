import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(new URL('../skills/dsh-safe-web-update/scripts/restart-dsh-web.sh', import.meta.url))
const temporaryPaths: string[] = []

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-safe-web-update-'))
  temporaryPaths.push(root)
  const repo = join(root, 'repo')
  const bin = join(root, 'bin')
  const log = join(root, 'commands.log')
  await mkdir(repo)
  await mkdir(bin)
  await writeFile(join(repo, 'package.json'), '{}\n')

  async function command(name: string, body: string) {
    const path = join(bin, name)
    await writeFile(path, `#!/usr/bin/env bash\nset -eu\n${body}\n`)
    await chmod(path, 0o755)
  }

  await command('ss', `
printf 'ss %s\\n' "$*" >> "$FAKE_LOG"
case "$*" in
  *-tlnp*) printf 'LISTEN 0 511 127.0.0.1:3080 0.0.0.0:* users:(("node",pid=%s,fd=18))\\n' "$FAKE_PID" ;;
  *-tln*) printf 'LISTEN 0 511 127.0.0.1:3080 0.0.0.0:*\\n' ;;
esac`)
  await command('ps', `
printf 'ps %s\\n' "$*" >> "$FAKE_LOG"
case "$*" in
  *cmd=*) printf 'node\\n' ;;
  *) printf '1\\n' ;;
esac`)
  await command('setsid', `printf 'setsid %s\\n' "$*" >> "$FAKE_LOG"`)
  await command('curl', `printf 'curl %s\\n' "$*" >> "$FAKE_LOG"`)

  return { bin, log, repo }
}

function run(args: string[], env: Record<string, string>) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('restart-dsh-web.sh', () => {
  it('documents its required confirmation flag', () => {
    const result = run(['--help'], {})
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('--confirm')
    expect(result.stdout).toContain('--dry-run')
  })

  it('is executable when packaged with the skill', async () => {
    expect((await stat(SCRIPT)).mode & 0o111).not.toBe(0)
  })

  it('refuses a real restart before inspecting listeners when confirmation is absent', async () => {
    const { bin, log, repo } = await fixture()
    const result = run(['--repo', repo], {
      FAKE_LOG: log,
      FAKE_PID: '999999',
      PATH: `${bin}:${process.env.PATH}`,
    })
    expect(result.status).toBe(64)
    expect(result.stderr).toContain('--confirm')
    await expect(readFile(log, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports the resolved listener tree in dry-run mode without stopping or launching it', async () => {
    const { bin, log, repo } = await fixture()
    const result = run(['--repo', repo, '--dry-run'], {
      FAKE_LOG: log,
      FAKE_PID: '424242',
      PATH: `${bin}:${process.env.PATH}`,
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('ss -tlnp')
    expect(commands).toContain('ps -o cmd= -p 424242')
    expect(commands).not.toContain('setsid')
  })

  it('does not launch a replacement when ports remain held after a confirmed stop', async () => {
    const { bin, log, repo } = await fixture()
    const result = run(['--repo', repo, '--confirm'], {
      FAKE_LOG: log,
      FAKE_PID: '999999',
      PATH: `${bin}:${process.env.PATH}`,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('port 3080 remains held')
    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('ss -tln')
    expect(commands).not.toContain('setsid')
  })
})
