import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

async function skill(name: string): Promise<string> {
  return readFile(new URL(`skills/${name}/SKILL.md`, `file://${root}/`), 'utf8')
}

/**
 * SKILL.md plus every Markdown reference file in the skill.
 *
 * The house style keeps the skill body short and pushes command detail into
 * `references/`, so a contract marker may legitimately live one file down. A
 * marker missing from the whole skill is still a failure; asserting only on
 * SKILL.md would turn every house-style trim into a false alarm.
 */
async function skillWithReferences(name: string): Promise<string> {
  const dir = new URL(`skills/${name}/references/`, `file://${root}/`)
  const references: string[] = []
  try {
    const entries = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()
    for (const entry of entries) references.push(await readFile(new URL(entry, dir), 'utf8'))
  } catch {
    // No references directory: the SKILL.md alone is the whole skill.
  }
  return [await skill(name), ...references].join('\n')
}

/**
 * The base skill teaches agents how to drive Govard. These assertions keep that
 * teaching in sync with the CLI contract: a change to the exit codes or the
 * container-free check must update the skill in the same release, and no CI job
 * would otherwise notice.
 */
describe('govard CLI contract documentation', () => {
  it('govard-toolbox documents the capability contract', async () => {
    const content = await skillWithReferences('govard-toolbox')
    for (const marker of ['govard capabilities', 'CAPABILITY_MISSING', '--checks integrity', '--strict']) {
      expect(content, `govard-toolbox must document ${marker}`).toContain(marker)
    }
  })

  it('review-in-worktree offers the container-free analysis path', async () => {
    const content = await skillWithReferences('review-in-worktree')
    expect(content).toContain('--checks integrity')
    expect(content).toMatch(/no Docker|no container/)
  })

  it('magento2-linter separates its own exit codes from Govard contract', async () => {
    const content = await skill('magento2-linter')
    expect(content).toContain('CAPABILITY_MISSING')
  })

  it('every govard framework skill states the Docker requirement', async () => {
    for (const name of ['govard-magento', 'govard-laravel', 'govard-symfony', 'govard-wordpress']) {
      const content = await skill(name)
      expect(content, `${name} must state the Docker requirement`).toMatch(/Docker (requirement|running)|need Docker/)
    }
  })

  it('only Magento 2 offers the container-free integrity audit; the others say it is unsupported', async () => {
    expect(await skill('govard-magento')).toContain('--checks integrity')
    for (const name of ['govard-laravel', 'govard-symfony', 'govard-wordpress']) {
      const content = (await skill(name)).replace(/\s+/g, ' ')
      expect(content, `${name} must say integrity is unsupported`).toMatch(/integrity[^.]*(not supported|not available|does not support)|(not supported|not available|no)[^.]*integrity/i)
    }
  })
})
