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
  'brainstorming', 'diagnosing-superpowers', 'dispatching-parallel-agents', 'executing-plans',
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

  it('keeps public skill content runtime-neutral', async () => {
    const entries = await readdir(SKILLS_DIR)
    // Native-tool proper nouns and harness names. Shapes are deliberately broad
    // so a NEW skill cannot reintroduce one and stay green:
    //  - `maestro` + underscore OR a bare CamelCase-free `maestroX` name
    //  - the govard tool family (govard_audit_lint, govard_deploy_plan/check,
    //    govard_env_up/down, govard_shell) while NOT matching legit env vars
    //    like `GOVARD_FRONTEND_SYNC_TARGET` or the `govard-toolbox` skill
    //  - `DSH`/`dsh` as a standalone word: the lookbehind/lookahead keep the
    //    legitimate `dsh-maestro-diagram`, `compatibility: dsh` and
    //    `dsh-safe-restart` references matching nothing.
    const FORBIDDEN = new RegExp([
      'maestro_[a-z_]+',                 // snake_case tool names
      'maestro[A-Z][A-Za-z]*',           // CamelCase tool names
      'govard_(?:audit_lint|deploy_(?:plan|check)|env_(?:up|down)|shell)', // govard tool family
      'mermaid_(?:verify|drift)',        // diagram plugin tool names
      '(?<![\\w-])dsh(?![\\w-])',        // bare DSH / dsh word
      'DeepSeek Harness',
      'ask_user_question', 'run_code', 'todo_write', 'subagent_fork',
    ].join('|'), 'i')
    for (const entry of entries) {
      const files = [join(entry, 'SKILL.md')]
      try {
        for (const ref of await readdir(join(SKILLS_DIR, entry, 'references')))
          if (ref.endsWith('.md')) files.push(join(entry, 'references', ref))
      } catch { /* no references dir */ }
      for (const file of files) {
        const raw = await readFile(join(SKILLS_DIR, file), 'utf-8')
        // Use the real parser: an ad-hoc `/^---\n[\s\S]*?\n---\n/` strip also
        // matches an opening `---` inside the body and would hide text after it.
        const body = parseFrontmatter(raw).body
        expect(body, file).not.toMatch(FORBIDDEN)
      }
    }
  })
})
