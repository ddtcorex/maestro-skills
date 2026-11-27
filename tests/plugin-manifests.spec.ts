import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AREAS } from '../src/areas.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

async function json(path: string) {
  return JSON.parse(await readFile(join(root, path), 'utf8')) as Record<string, unknown>
}

type Entry = Record<string, unknown>

describe('area plugins', () => {
  it('the Claude marketplace lists exactly the areas', async () => {
    const marketplace = await json('.claude-plugin/marketplace.json')
    const plugins = marketplace.plugins as Entry[]
    expect(plugins.map(p => p.name).sort()).toEqual(Object.keys(AREAS).sort())
    for (const p of plugins) expect(p.source, String(p.name)).toBe(`./plugins/${p.name}`)
  })

  it('every area has a Claude plugin.json named after it', async () => {
    for (const area of Object.keys(AREAS)) {
      const manifest = await json(`plugins/${area}/.claude-plugin/plugin.json`)
      expect(manifest.name, area).toBe(area)
    }
  })

  it('every skill directory belongs to the area AREAS names, and no other', () => {
    const onDisk = readdirSync(join(root, 'plugins')).filter(d => !d.startsWith('.'))
    expect(onDisk.sort()).toEqual(Object.keys(AREAS).sort())
    for (const [area, skills] of Object.entries(AREAS)) {
      const dir = join(root, 'plugins', area, 'skills')
      const found = existsSync(dir) ? readdirSync(dir).filter(d => existsSync(join(dir, d, 'SKILL.md'))) : []
      expect(found.sort(), area).toEqual([...skills].sort())
    }
  })

  it('no flat skills directory remains at the repo root', () => {
    expect(existsSync(join(root, 'skills'))).toBe(false)
  })

  it('every manifest carries the package.json version', async () => {
    const pkg = await json('package.json')
    const marketplace = await json('.claude-plugin/marketplace.json')
    expect((marketplace.metadata as Entry).version).toBe(pkg.version)
    for (const p of marketplace.plugins as Entry[]) expect(p.version, String(p.name)).toBe(pkg.version)
    for (const area of Object.keys(AREAS)) {
      expect((await json(`plugins/${area}/.claude-plugin/plugin.json`)).version, area).toBe(pkg.version)
    }
  })
})
