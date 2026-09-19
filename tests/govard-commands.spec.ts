import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILLS = join(__dirname, '..', 'skills')
function readSkill(...segs: string[]) {
  return readFileSync(join(SKILLS, ...segs), 'utf-8')
}
function allGovardMd(): string[] {
  const out: string[] = []
  for (const skill of readdirSync(SKILLS).filter(d => d.startsWith('govard-'))) {
    out.push(readSkill(skill, 'SKILL.md'))
    try {
      for (const f of readdirSync(join(SKILLS, skill, 'references')))
        if (f.endsWith('.md')) out.push(readSkill(skill, 'references', f))
    } catch { /* no references dir */ }
  }
  return out
}

describe('govard command truth', () => {
  it('sandbox is top-level, never under deploy', () => {
    expect(readSkill('govard-toolbox', 'SKILL.md')).toContain('govard sandbox up')
    for (const text of allGovardMd())
      expect(text.includes('deploy sandbox'), 'stale deploy sandbox spelling').toBe(false)
  })
  it('govard open lists real targets only', () => {
    for (const text of allGovardMd())
      expect(text.includes('govard open app'), 'open app does not exist').toBe(false)
  })
  it('varnish uses ban/ps/stats, never purge/status', () => {
    for (const text of allGovardMd()) {
      expect(text.includes('varnish purge'), 'unknown varnish subcommand').toBe(false)
      expect(text.includes('varnish status'), 'unknown varnish subcommand').toBe(false)
    }
  })
  it('project orphans is a subcommand, not a flag', () => {
    for (const text of allGovardMd())
      expect(text.includes('project list --orphans'), 'moved to project orphans').toBe(false)
  })
  it('no project clean subcommand', () => {
    for (const text of allGovardMd())
      expect(text.includes('project clean'), 'use env cleanup').toBe(false)
  })
  it('audit documents all three checks', () => {
    const cmds = readSkill('govard-toolbox', 'references', 'COMMANDS.md')
    expect(cmds).toContain('integrity')
    expect(cmds.includes('lint is the only check'), 'stale single-check claim').toBe(false)
  })
})
