import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const skills = join(__dirname, '..', 'skills')
const DIRS = ['magento2-dev-core', 'magento2-performance-audit', 'magento2-linter', 'magento2-security-scan', 'magento2-code-review']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('report skills carry no em or en dashes', () => {
  it('has no U+2014 or U+2013 in any file', () => {
    const hits: string[] = []
    for (const dir of DIRS) {
      for (const file of walk(join(skills, dir))) {
        readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
          if (/[\u2013\u2014]/.test(line)) hits.push(`${file.slice(skills.length + 1)}:${i + 1}`)
        })
      }
    }
    expect(hits).toEqual([])
  })
})
