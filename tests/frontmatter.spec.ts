import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../src/frontmatter.ts'

describe('parseFrontmatter', () => {
  it('folds a block-scalar description into a single-line string', () => {
    const md = [
      '---',
      'name: x',
      'description: |',
      '  First line here.',
      '  Second "quoted" line.',
      'compatibility: claude, dsh',
      '---',
      '',
      '# Body',
    ].join('\n')
    const { metadata, body } = parseFrontmatter(md)
    expect(metadata.description).toBe('First line here. Second "quoted" line.')
    expect(metadata.compatibility).toBe('claude, dsh')
    expect(body).toContain('# Body')
  })

  it('keeps flattening plain nested maps (historical behavior)', () => {
    const md = '---\nname: y\nmetadata:\n  audience: developers\n  workflow: magento\n---\nBody'
    const { metadata } = parseFrontmatter(md)
    expect(metadata.audience).toBe('developers')
    expect(metadata.workflow).toBe('magento')
    expect(metadata.metadata).toBe('')
  })

  it('stops folding at the first dedented key', () => {
    const md = '---\ndescription: |\n  Long text.\ndepends: [govard-toolbox]\n---\nB'
    const { metadata } = parseFrontmatter(md)
    expect(metadata.description).toBe('Long text.')
    expect(metadata.depends).toBe('[govard-toolbox]')
  })

  it('returns empty metadata without frontmatter', () => {
    expect(parseFrontmatter('# Just markdown')).toEqual({ metadata: {}, body: '# Just markdown' })
  })

  it('treats unterminated frontmatter as body-only', () => {
    const { metadata, body } = parseFrontmatter('---\nname: x\n# rest')
    expect(metadata).toEqual({})
    expect(body).toContain('# rest')
  })
})
