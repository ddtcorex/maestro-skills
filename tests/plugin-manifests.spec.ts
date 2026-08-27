import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

async function json(path: string) {
  return JSON.parse(await readFile(new URL(path, `file://${root}/`), 'utf8')) as Record<string, unknown>
}

describe('release manifests', () => {
  it('publishes the safe DSH Web update skill in one aligned patch release', async () => {
    const [pkg, claude, codex, marketplace] = await Promise.all([
      json('package.json'),
      json('.claude-plugin/plugin.json'),
      json('.codex-plugin/plugin.json'),
      json('.claude-plugin/marketplace.json'),
    ])
    const version = '2.3.1'
    expect(pkg.version).toBe(version)
    expect(claude.version).toBe(version)
    expect(codex.version).toBe(version)
    expect((marketplace.metadata as Record<string, unknown>).version).toBe(version)
    expect(((marketplace.plugins as Array<Record<string, unknown>>)[0]).version).toBe(version)
  })
})
