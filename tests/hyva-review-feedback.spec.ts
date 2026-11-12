import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILL_DIR = join(__dirname, '..', 'skills', 'magento2-hyva-dev')
/**
 * The whole skill, body plus references. The house style keeps SKILL.md short and
 * pushes the review checklist into `references/`, so a lesson may move one file
 * down; a lesson missing from the skill entirely still fails.
 */
function skill() {
  const references = readdirSync(join(SKILL_DIR, 'references')).filter(f => f.endsWith('.md'))
  return [
    readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf-8'),
    ...references.map(f => readFileSync(join(SKILL_DIR, 'references', f), 'utf-8')),
  ].join('\n')
}

describe('hyva review feedback: Alpine nested scope', () => {
  it('teaches that a nested x-data reads and writes its ancestors', () => {
    // A review once flagged a binding as undefined because the property lived on
    // the parent component; the child template was rendered inside it.
    expect(skill()).toContain('### 6. Alpine scope follows the DOM')
    expect(skill()).toMatch(/ancestor `x-data`/)
    expect(skill()).toContain('createBlock()')
  })

  it('requires checking sibling fields that use the same pattern before claiming a binding is undefined', () => {
    expect(skill()).toMatch(/same pattern/)
    expect(skill()).toMatch(/not defined/)
  })
})
