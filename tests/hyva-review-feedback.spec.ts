import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILL = join(__dirname, '..', 'skills', 'magento2-hyva-dev', 'SKILL.md')
function skill() { return readFileSync(SKILL, 'utf-8') }

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
