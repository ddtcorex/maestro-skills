import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = (p: string): string => join(fileURLToPath(new URL('..', import.meta.url)), p)
const pluginSource = readFileSync(repo('src/index.ts'), 'utf8')

// The plugin used to copy `.dsh-plugin/` into `$DSH_HOME/.agent-presets/<id>/`
// on every boot and log "DSH agent preset installed at …". DSH stopped reading
// that directory when presets became `@deepseek-ai/dsh-agent-preset`
// declaration rows (2026-09-22): the profile's `cordis.patch.yml` declares
// `preset-maestro-skills` / `preset-maestro-skills-subagents` directly, and the
// write path did nothing but litter and mislead. It is removed; these pin that
// it stays removed and that the template it wrote from still ships, because the
// declaration rows are hand-copied from it.
describe('agent preset installation', () => {
  it('the plugin never writes the directory DSH stopped reading', () => {
    expect(pluginSource).not.toMatch(/agent-presets/)
    expect(pluginSource).not.toMatch(/materializePreset|preset-materialize/)
    expect(pluginSource).not.toMatch(/installPreset|installSubagentPreset|presetUpgrade/)
  })

  it('the plugin does not log a preset installation that changes nothing', () => {
    // The misleading part was the success log, not just the write: an operator
    // saw "installed" and believed the agent picker had been updated.
    expect(pluginSource).not.toMatch(/agent preset installed/)
    expect(pluginSource).not.toMatch(/preset variant installed/)
  })

  it('the preset template still ships — the declaration rows are copied from it', () => {
    // Removing the write path must not remove the source of truth. A consumer
    // enabling the roster still hand-copies these into a declaration row.
    const pkg = JSON.parse(readFileSync(repo('package.json'), 'utf8')) as { files: string[] }
    expect(pkg.files).toContain('.dsh-plugin')
    expect(existsSync(repo('.dsh-plugin/preset.yml'))).toBe(true)
    expect(existsSync(repo('.dsh-plugin/agent.cordis.yml'))).toBe(true)
  })
})
