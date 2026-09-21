import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SKILL = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'SKILL.md')
function skill() { return readFileSync(SKILL, 'utf-8') }

describe('perf-audit feedback P1', () => {
  it('defines On DSH via the deferred tools list', () => {
    expect(skill()).toContain('deferred tools list')
  })
})
