import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

async function skill(name: string): Promise<string> {
  return readFile(new URL(`skills/${name}/SKILL.md`, `file://${root}/`), 'utf8')
}

/**
 * The base skill teaches agents how to drive Govard. These assertions keep that
 * teaching in sync with the CLI contract: a change to the exit codes or the
 * container-free check must update the skill in the same release, and no CI job
 * would otherwise notice.
 */
describe('govard CLI contract documentation', () => {
  it('govard-toolbox documents the capability contract', async () => {
    const content = await skill('govard-toolbox')
    for (const marker of ['govard capabilities', 'CAPABILITY_MISSING', '--checks integrity', '--strict']) {
      expect(content, `govard-toolbox must document ${marker}`).toContain(marker)
    }
  })

  it('review-in-worktree offers the container-free analysis path', async () => {
    const content = await skill('review-in-worktree')
    expect(content).toContain('--checks integrity')
    expect(content).toContain('no Docker')
  })

  it('magento2-linter separates its own exit codes from Govard contract', async () => {
    const content = await skill('magento2-linter')
    expect(content).toContain('CAPABILITY_MISSING')
  })

  it('every govard framework skill states the Docker requirement', async () => {
    for (const name of ['govard-magento', 'govard-laravel', 'govard-symfony', 'govard-wordpress']) {
      const content = await skill(name)
      expect(content, `${name} must state the Docker requirement`).toContain('Docker requirement')
      expect(content, `${name} must point at the container-free check`).toContain('--checks integrity')
    }
  })
})
