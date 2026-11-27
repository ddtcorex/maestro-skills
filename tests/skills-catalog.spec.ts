import { readdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/frontmatter.ts'
import { ALL_SKILLS, skillPath } from './helpers/skills'

const DOMAIN_PATTERN = /^(dsh|magento2|govard)-/
// The obra/superpowers fork left this repo in v5; none of these names may come back.
const FORMERLY_FORKED = [
  'brainstorming', 'diagnosing-superpowers', 'dispatching-parallel-agents', 'executing-plans',
  'finishing-a-development-branch', 'receiving-code-review', 'requesting-code-review',
  'subagent-driven-development', 'systematic-debugging', 'test-driven-development',
  'using-git-worktrees', 'using-superpowers', 'verification-before-completion',
  'writing-plans', 'writing-skills',
]

function load(skill: string) {
  return readFile(skillPath(skill, 'SKILL.md'), 'utf-8').then(raw => ({
    raw,
    metadata: parseFrontmatter(raw).metadata,
  }))
}

describe('skills catalog', () => {
  it('every domain skill has a folded description and declares dsh', async () => {
    const entries = ALL_SKILLS.filter(e => DOMAIN_PATTERN.test(e))
    expect(entries.length).toBeGreaterThanOrEqual(12)
    for (const entry of entries) {
      const { metadata } = await load(entry)
      expect(metadata.name, entry).toBe(entry)
      expect(metadata.description, entry).not.toBe('')
      expect(metadata.description, entry).not.toContain('\n')
      expect(metadata.compatibility?.split(',').map(s => s.trim()), entry).toContain('dsh')
    }
  })

  it('carries no superpowers fork', async () => {
    const entries = ALL_SKILLS
    for (const name of FORMERLY_FORKED) expect(entries, name).not.toContain(name)
  })

  it('mentions the superpowers fork nowhere outside CHANGELOG', () => {
    let out = ''
    try {
      out = execFileSync('git', ['grep', '-l', '-i', '-E', 'obra/superpowers|sync-superpowers|superpowers (process|fork|library|methodology|workflow\\))', '--', '.', ':!CHANGELOG.md', ':!tests/skills-catalog.spec.ts'], { encoding: 'utf8' }).trim()
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e // exit 1 means no match
    }
    expect(out).toBe('')
  })

  it('no skill nests govard inside its own container shell', async () => {
    const entries = ALL_SKILLS
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
    expect(raw).toMatch(/must fail fast/)
    expect(raw).toMatch(/never remove a lock/)
  })

  it('acquires the query-log lock before enabling global diagnostics', async () => {
    const reference = await readFile(skillPath('magento2-performance-audit', 'references', 'database-query-profiling.md'), 'utf-8')
    expect(reference.indexOf('# Claim this global diagnostic resource')).toBeLessThan(reference.indexOf('# Enable full query logging'))
    expect(reference).toContain('owner missing')
  })

  it('does not leave owner checks outside global diagnostic mutations', async () => {
    const base = skillPath('magento2-performance-audit', 'references')
    const [database, perPage] = await Promise.all([
      readFile(join(base, 'database-query-profiling.md'), 'utf-8'),
      readFile(join(base, 'per-page-type-audit.md'), 'utf-8'),
    ])
    expect(database).toMatch(/test .*performance-audit\.lock\/owner.*audit_token.*bin\/magento dev:query-log:enable/)
    expect(database).not.toContain('govard db query "SET GLOBAL slow_query_log')
    expect(perPage).toMatch(/test .*\$lock\/owner.*audit_token.*bin\/magento cache:enable/)
  })

  it('domain skills carry no capability conditionals for removed harness tools', async () => {
    // The harness tool surface for govard (deploy plan/check, lint, query-log stats,
    // workspace search) was removed; skills must name the direct CLI instead of
    // "a native tool where provided".
    const REMOVED_TOOL_PROSE = new RegExp([
      'native (?:deploy|lint|query-log|stats|workspace search)[\\w\\s/-]*tool',
      'where provided',
      'runtime provides a native',
      'bounded workspace search tool',
      'native stats (?:tool|streaming)',
      '<search tool>',
    ].join('|'), 'i')
    const entries = (ALL_SKILLS)
    for (const entry of entries) {
      const files = [join(entry, 'SKILL.md')]
      try {
        for (const ref of await readdir(skillPath(entry, 'references')))
          if (ref.endsWith('.md')) files.push(join(entry, 'references', ref))
      } catch { /* no references dir */ }
      for (const file of files) {
        const raw = await readFile(skillPath(file.split('/')[0], ...file.split('/').slice(1)), 'utf-8')
        expect(raw, file).not.toMatch(REMOVED_TOOL_PROSE)
      }
    }
  })

  it('keeps public skill content runtime-neutral', async () => {
    const entries = ALL_SKILLS
    // Native-tool proper nouns and harness names. Shapes are deliberately broad
    // so a NEW skill cannot reintroduce one and stay green:
    //  - `maestro` + underscore OR a bare CamelCase-free `maestroX` name
    //  - the govard tool family (govard_audit_lint, govard_deploy_plan/check,
    //    govard_env_up/down, govard_shell) while NOT matching legit env vars
    //    like `GOVARD_FRONTEND_SYNC_TARGET` or the `govard-toolbox` skill
    //  - `DSH`/`dsh` as a standalone word: the lookbehind/lookahead keep the
    //    legitimate `compatibility: dsh` and
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
        for (const ref of await readdir(skillPath(entry, 'references')))
          if (ref.endsWith('.md')) files.push(join(entry, 'references', ref))
      } catch { /* no references dir */ }
      for (const file of files) {
        const raw = await readFile(skillPath(file.split('/')[0], ...file.split('/').slice(1)), 'utf-8')
        // Use the real parser: an ad-hoc `/^---\n[\s\S]*?\n---\n/` strip also
        // matches an opening `---` inside the body and would hide text after it.
        const body = parseFrontmatter(raw).body
        expect(body, file).not.toMatch(FORBIDDEN)
      }
    }
  })

  it('README and AGENTS list every shipped skill and its declared dependencies', async () => {
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf-8')
    const agents = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf-8')
    const entries = (ALL_SKILLS)
    for (const entry of entries) {
      expect(readme, `README.md must mention ${entry}`).toContain(entry)
      const { raw } = await load(entry)
      const depends = /^depends:\s*\[(.*?)\]/m.exec(raw)?.[1]
      if (!depends) continue
      // AGENTS.md documents the chain as `<skill>` ... `depends: [<dep>]`; require the
      // dependent skill to be named there so a new dependent cannot go unlisted.
      expect(agents, `AGENTS.md dependency chain must mention ${entry}`).toContain(entry)
    }
  })

  it('README does not claim the plugin entrypoint installs the agent preset', async () => {
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf-8')
    expect(readme).not.toMatch(/index\.ts[^\n]*installs the DSH agent preset/)
  })

  it('README has no stray single-row skill table', async () => {
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf-8')
    expect(readme).not.toContain('| Skill | Description |')
  })
})
