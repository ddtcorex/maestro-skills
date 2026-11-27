import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/frontmatter.ts'
import { AREAS } from '../src/areas.ts'
import { skillPath } from './helpers/skills'

const CRAFT = AREAS['maestro-craft'] ?? []

describe('maestro-craft contract', () => {
  it('ships the craft skills', () => {
    expect([...CRAFT].sort()).toEqual(['prior-art-search', 'source-to-skill'])
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

      it('never runs the skills registry CLI unpinned', () => {
        expect(raw()).not.toMatch(/npx skills(?!@\d)/)
      })

      it('carries no em or en dash', () => {
        expect(raw()).not.toMatch(/[–—]/)
      })
    })
  }
})
