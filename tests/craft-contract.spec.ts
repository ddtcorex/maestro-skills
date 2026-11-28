import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/frontmatter.ts'
import { AREAS } from '../src/areas.ts'
import { skillPath } from './helpers/skills'

const CRAFT = AREAS['maestro-craft'] ?? []
// Any package runner invoking the registry CLI must name an exact version.
const UNPINNED = /(?:npx|dlx|bunx)\s+(?:-\S+\s+)*skills(?!@\d+\.\d+\.\d+)/

function markdownUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    return statSync(p).isDirectory() ? markdownUnder(p) : p.endsWith('.md') ? [p] : []
  })
}

describe('maestro-craft contract', () => {
  it('ships the craft skills', () => {
    expect([...CRAFT].sort()).toEqual(['decision-models', 'principles-from-own-writing', 'prior-art-search', 'source-to-skill'])
  })

  it('the unpinned pattern catches every runner form and passes a pinned one', () => {
    for (const bad of ['npx skills find x', 'npx -y skills find x', 'pnpm dlx skills add y', 'bunx skills find', 'npx skills@1 find'])
      expect(bad, bad).toMatch(UNPINNED)
    expect('npx skills@1.9.0 find x').not.toMatch(UNPINNED)
  })

  it('every craft scenario fixture belongs to a shipped craft skill', () => {
    const fixtures = readdirSync(join(__dirname, 'fixtures', 'craft'))
    expect(fixtures.sort()).toEqual([...CRAFT].sort())
  })

  for (const skill of CRAFT) {
    describe(skill, () => {
      const raw = () => readFileSync(skillPath(skill, 'SKILL.md'), 'utf8')

      it('has a single-line Use when description and declares dsh', () => {
        const { metadata, body } = parseFrontmatter(raw())
        expect(metadata.name).toBe(skill)
        expect(metadata.description).toMatch(/^Use when /)
        expect(metadata.description).not.toContain('\n')
        expect(metadata.compatibility?.split(',').map(s => s.trim())).toContain('dsh')
        expect(body.split('\n').length).toBeLessThan(500)
      })

      it('never runs the skills registry CLI unpinned, in any file of the skill', () => {
        for (const file of markdownUnder(skillPath(skill))) expect(readFileSync(file, 'utf8'), file).not.toMatch(UNPINNED)
      })

      it('carries no em or en dash', () => {
        expect(raw()).not.toMatch(/[\u2013\u2014]/)
      })
    })
  }

  it('decision-models gates on a measured baseline and points at the vendor skill instead of restating the API', () => {
    const raw = readFileSync(skillPath('decision-models', 'SKILL.md'), 'utf8')
    // A model score means nothing without the constant-answer score next to it.
    expect(raw).toMatch(/majority[- ]class baseline/i)
    expect(raw).toMatch(/typesafe-ai\/skills/)
    // Confidence is a concentration measure, not a correctness gate.
    expect(raw).toMatch(/confidence is not a gate/i)
  })

  it('source-to-skill checks for yt-dlp before relying on it and names the fallback', () => {
    const raw = readFileSync(skillPath('source-to-skill', 'SKILL.md'), 'utf8')
    // A host without yt-dlp must not fall back to a page reader silently.
    expect(raw).toMatch(/command -v yt-dlp/)
    expect(raw).toMatch(/not installed[^.]*say so/i)
  })
})

