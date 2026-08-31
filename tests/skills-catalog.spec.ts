import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/frontmatter.ts'

const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url))
const DOMAIN_PATTERN = /^(dsh|magento2|govard)-/
// Forked-from-upstream skills must stay verbatim; only domain skills carry
// fork-local frontmatter additions such as `compatibility`.
const FORKED = [
  'brainstorming', 'dispatching-parallel-agents', 'executing-plans',
  'finishing-a-development-branch', 'receiving-code-review', 'requesting-code-review',
  'subagent-driven-development', 'systematic-debugging', 'test-driven-development',
  'using-git-worktrees', 'using-superpowers', 'verification-before-completion',
  'writing-plans', 'writing-skills',
]

function load(skill: string) {
  return readFile(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8').then(raw => ({
    raw,
    metadata: parseFrontmatter(raw).metadata,
  }))
}

describe('skills catalog', () => {
  it('every domain skill has a folded description and declares dsh', async () => {
    const entries = (await readdir(SKILLS_DIR)).filter(e => DOMAIN_PATTERN.test(e))
    expect(entries.length).toBeGreaterThanOrEqual(12)
    for (const entry of entries) {
      const { metadata } = await load(entry)
      expect(metadata.name, entry).toBe(entry)
      expect(metadata.description, entry).not.toBe('')
      expect(metadata.description, entry).not.toContain('\n')
      expect(metadata.compatibility?.split(',').map(s => s.trim()), entry).toContain('dsh')
    }
  })

  it('forked skills keep upstream frontmatter shape', async () => {
    for (const skill of FORKED) {
      const { metadata } = await load(skill)
      expect(metadata.compatibility, skill).toBeUndefined()
    }
  })

  it('no skill nests govard inside its own container shell', async () => {
    const entries = await readdir(SKILLS_DIR)
    for (const entry of entries) {
      const { raw } = await load(entry)
      expect(raw, entry).not.toMatch(/govard\s+sh\s+-c\s+"govard\s+/)
    }
  })

  it('govard-magento routes magento CLI through govard tool', async () => {
    const { raw } = await load('govard-magento')
    expect(raw).toContain('govard tool magento ')
    expect(raw).not.toMatch(/govard\s+sh\s+-c\s+"bin\/magento/)
  })

  it('guards shared Magento query-log captures with an owner token', async () => {
    const { raw } = await load('magento2-performance-audit')
    expect(raw).toContain('.performance-audit.lock')
    expect(raw).toContain('session token')
    expect(raw).toContain('fail-fast')
    expect(raw).toContain('do not remove a lock')
  })

  it('acquires the query-log lock before enabling global diagnostics', async () => {
    const reference = await readFile(join(SKILLS_DIR, 'magento2-performance-audit', 'references', 'database-query-profiling.md'), 'utf-8')
    expect(reference.indexOf('# Claim this global diagnostic resource')).toBeLessThan(reference.indexOf('# Enable full query logging'))
    expect(reference).toContain('owner missing')
  })

  it('does not leave owner checks outside global diagnostic mutations', async () => {
    const base = join(SKILLS_DIR, 'magento2-performance-audit', 'references')
    const [database, perPage] = await Promise.all([
      readFile(join(base, 'database-query-profiling.md'), 'utf-8'),
      readFile(join(base, 'per-page-type-audit.md'), 'utf-8'),
    ])
    expect(database).toMatch(/test .*performance-audit\.lock\/owner.*audit_token.*bin\/magento dev:query-log:enable/)
    expect(database).not.toContain('govard db query "SET GLOBAL slow_query_log')
    expect(perPage).toMatch(/test .*\$lock\/owner.*audit_token.*bin\/magento cache:enable/)
  })
})
