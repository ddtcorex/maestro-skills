import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { perfScripts } from './helpers/perf-harness'

describe('resolveCaFile', () => {
  it('prefers caFile from the config', async () => {
    const { resolveCaFile } = await import(join(perfScripts, 'lib', 'http.mjs'))
    expect(resolveCaFile({ caFile: '/etc/ca.pem' }, { HOME: '/nowhere' })).toBe('/etc/ca.pem')
  })

  it('falls back to the Govard root CA when it exists', async () => {
    const { resolveCaFile } = await import(join(perfScripts, 'lib', 'http.mjs'))
    const home = mkdtempSync(join(tmpdir(), 'perf-home-'))
    try {
      mkdirSync(join(home, '.govard', 'ssl'), { recursive: true })
      writeFileSync(join(home, '.govard', 'ssl', 'root.crt'), 'pem')
      expect(resolveCaFile({}, { HOME: home })).toBe(join(home, '.govard', 'ssl', 'root.crt'))
      expect(resolveCaFile({}, { HOME: '/nowhere' })).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
