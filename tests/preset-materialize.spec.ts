import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  decideFileAction,
  materializePreset,
  readPackageVersion,
  readStamp,
  sha256File,
  writeStamp,
} from '../src/preset-materialize.ts'

describe('decideFileAction', () => {
  const i: (p: Partial<Parameters<typeof decideFileAction>[0]>) => Parameters<typeof decideFileAction>[0] =
    p => ({ srcHash: 'src1', dstHash: 'dst1', stampHash: 'stamp1', mode: 'auto', ...p })

  it('installs when the destination file is missing', () => {
    expect(decideFileAction(i({ dstHash: undefined }))).toBe('install')
  })

  it('adopts when there is no stamp entry', () => {
    expect(decideFileAction(i({ stampHash: undefined }))).toBe('adopt')
  })

  it('skips when the user edited the file (dst differs from stamp)', () => {
    expect(decideFileAction(i({ dstHash: 'user1', stampHash: 'stamp1' }))).toBe('skip')
  })

  it('upgrades a pristine file when the bundle advanced (src differs from stamp)', () => {
    expect(decideFileAction(i({ srcHash: 'src2', dstHash: 'stamp1', stampHash: 'stamp1' }))).toBe('upgrade')
  })

  it('no-ops a pristine file when the bundle is unchanged', () => {
    expect(decideFileAction(i({ srcHash: 'stamp1', dstHash: 'stamp1', stampHash: 'stamp1' }))).toBe('no-op')
  })

  it("blocks upgrades in 'keep' mode even when pristine", () => {
    expect(decideFileAction(i({ srcHash: 'src2', dstHash: 'stamp1', stampHash: 'stamp1', mode: 'keep' }))).toBe('skip')
  })

  it("forces upgrade over a user edit in 'force' mode", () => {
    expect(decideFileAction(i({ dstHash: 'user1', stampHash: 'stamp1', mode: 'force' }))).toBe('upgrade')
  })

  it("still installs a missing file even in 'force' mode", () => {
    expect(decideFileAction(i({ dstHash: undefined, mode: 'force' }))).toBe('install')
  })
})

describe('stamp + hash IO', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'preset-mat-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('sha256File hashes exact bytes', async () => {
    const p = join(dir, 'a.txt')
    writeFileSync(p, 'hello')
    expect(await sha256File(p)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('readStamp returns undefined for a missing file and a malformed JSON', async () => {
    expect(await readStamp(join(dir, 'nope.json'))).toBeUndefined()
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, '{not json')
    expect(await readStamp(bad)).toBeUndefined()
  })

  it('writeStamp then readStamp round-trips', async () => {
    const p = join(dir, 'preset.materialize.json')
    await writeStamp(p, { version: '2.10.0', files: { 'agent.cordis.yml': { sha256: 'abc' } } })
    const back = await readStamp(p)
    expect(back).toEqual({ version: '2.10.0', files: { 'agent.cordis.yml': { sha256: 'abc' } } })
  })

  it('readPackageVersion resolves ../package.json from a src/ dir', async () => {
    const srcDir = join(dir, 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.2.3' }))
    expect(await readPackageVersion(srcDir)).toBe('1.2.3')
  })
})

describe('materializePreset orchestrator', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'preset-mat-orch-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })
  const srcDir = () => { const s = join(dir, 'src-pkg'); mkdirSync(s, { recursive: true }); return s }

  it('installs into a missing dir and writes the stamp with src hashes', async () => {
    const src = srcDir()
    const presetFiles = ['agent.cordis.yml', 'preset.yml']
    for (const f of presetFiles) writeFileSync(join(src, f), `content-${f}`)
    const res = await materializePreset({
      presetId: 'dest',
      srcDir: src,
      presetFiles,
      mode: 'auto',
      version: '2.10.0',
      homeDir: dir,
    })
    expect(res?.actions['agent.cordis.yml']).toBe('install')
    expect(res?.actions['preset.yml']).toBe('install')
    const dest = join(dir, '.dsh', '.agent-presets', 'dest')
    expect(readFileSync(join(dest, 'agent.cordis.yml'), 'utf8')).toBe('content-agent.cordis.yml')
    const stamp = await readStamp(join(dest, 'preset.materialize.json'))
    expect(stamp?.version).toBe('2.10.0')
    expect(stamp?.files['agent.cordis.yml'].sha256).toBe(await sha256File(join(src, 'agent.cordis.yml')))
  })

  it('skips a user-edited file and leaves it untouched', async () => {
    const src = srcDir()
    const presetFiles = ['agent.cordis.yml']
    writeFileSync(join(src, presetFiles[0]), 'v1')
    await materializePreset({ presetId: 'dest2', srcDir: src, presetFiles, mode: 'auto', version: '1.0.0', homeDir: dir })
    const dest = join(dir, '.dsh', '.agent-presets', 'dest2')
    // user edits the installed file
    writeFileSync(join(dest, presetFiles[0]), 'USER EDIT')
    const res = await materializePreset({ presetId: 'dest2', srcDir: src, presetFiles, mode: 'auto', version: '1.0.0', homeDir: dir })
    expect(res?.actions[presetFiles[0]]).toBe('skip')
    expect(readFileSync(join(dest, presetFiles[0]), 'utf8')).toBe('USER EDIT')
  })
})