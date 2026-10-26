import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const skills = join(__dirname, '..', 'skills')
const fixtures = join(__dirname, 'fixtures', 'report')
const devCoreLib = join(skills, 'magento2-dev-core', 'scripts', 'report', 'lib')

describe('QA skills render the shared findings report', () => {
  for (const skill of ['magento2-linter', 'magento2-security-scan', 'magento2-code-review']) {
    it(`${skill} writes findings.json and renders it through the shared engine`, () => {
      const body = readFileSync(join(skills, skill, 'SKILL.md'), 'utf-8')
      expect(body).toContain('findings.json')
      expect(body).toContain('render.mjs render --layout findings')
      expect(body).toContain('findings-schema.md')
    })
  }

  it('code review merges its inputs with merge-findings.mjs', () => {
    expect(readFileSync(join(skills, 'magento2-code-review', 'SKILL.md'), 'utf-8')).toContain('merge-findings.mjs')
  })
})

describe('mergeFindings', () => {
  it('merges linter, security and perf findings into one valid file', async () => {
    const { mergeFindings } = await import(join(skills, 'magento2-code-review', 'scripts', 'merge-findings.mjs'))
    const { validateFindings } = await import(join(devCoreLib, 'validate.mjs'))
    const merged = mergeFindings(['findings.json', 'findings-security.json', 'findings-perf.json'].map((f) => join(fixtures, f)))
    expect(merged.tool).toBe('magento2-code-review')
    expect(validateFindings(merged)).toEqual([])
    // Foo.php:42 M2-ARCH-001 appears twice (high and medium): kept once at high.
    // Bar.php:10 M2-SEC-006 appears twice at high: kept once.
    expect(merged.findings).toHaveLength(4)
    expect(merged.summary).toEqual({ critical: 1, high: 2, medium: 1, low: 0 })
    expect(merged.findings.find((f: { file: string }) => f.file.endsWith('Foo.php')).severity).toBe('high')
    expect(merged.verdict).toBe('1 critical, 2 high, 1 medium findings')
  })
})
