import { describe, expect, it } from 'vitest'
import { stripOptionalSubagentDisabled, subagentPresetYml } from '../src/subagent-variant.ts'

describe('stripOptionalSubagentDisabled', () => {
  it('strips plain disabled:true from both optional subagent rows only', () => {
    const yml = [
      '    - id: tool-subagent',
      '      name: "@deepseek-ai/dsh-tool-subagent"',
      '      config: { provider: spawn }',
      '    - id: tool-subagent-codex',
      '      name: "@deepseek-ai/dsh-tool-subagent"',
      '      disabled: true',
      '      config: { provider: codex }',
      '    - id: tool-subagent-claude-code',
      '      name: "@deepseek-ai/dsh-tool-subagent"',
      '      disabled: true',
      '      config: { provider: claude-code }',
      '    - id: some-other-tool',
      '      disabled: true',
      '',
    ].join('\n')
    const out = stripOptionalSubagentDisabled(yml)
    // both optional rows keep their rows but lose the disabled marker
    expect(out).toContain('    - id: tool-subagent-codex\n      name: "@deepseek-ai/dsh-tool-subagent"\n      config: { provider: codex }')
    expect(out).not.toContain('    - id: tool-subagent-codex\n      name: "@deepseek-ai/dsh-tool-subagent"\n      disabled: true')
    expect(out).toContain('    - id: tool-subagent-claude-code\n      name: "@deepseek-ai/dsh-tool-subagent"\n      config: { provider: claude-code }')
    expect(out).not.toContain('    - id: tool-subagent-claude-code\n      name: "@deepseek-ai/dsh-tool-subagent"\n      disabled: true')
    // unrelated disabled row survives
    expect(out).toContain('    - id: some-other-tool\n      disabled: true')
  })

  it('never strips the !!js platform gate lines', () => {
    const yml = '  disabled: !!js process.platform === \'win32\'\n  disabled: !!js process.platform !== \'win32\'\n'
    expect(stripOptionalSubagentDisabled(yml)).toBe(yml)
  })
})

describe('subagentPresetYml', () => {
  it('rewrites name and description', () => {
    const out = subagentPresetYml('name: Maestro Skills\ndescription: AI Agent preset bundling the maestro-skills library.\n')
    expect(out).toContain('name: Maestro Skills + Subagents (Codex + Claude)')
    expect(out).toContain('subagent_codex')
    expect(out).toContain('subagent_claude_code')
  })

  it('emits a metadata doc DSH can parse (block scalar survives colons+spaces)', () => {
    const out = subagentPresetYml('name: Maestro Skills\ndescription: base.\n')
    const lines = out.split('\n')
    // same rule js-yaml enforces for a plain scalar: a colon followed by a
    // space on an unindented line would split into a mapping entry and fail
    // readPresetMetadata; the description must be a folded block (indented)
    // so "Note: both" stays content
    expect(lines[0]).toBe('name: Maestro Skills + Subagents (Codex + Claude)')
    expect(lines[1]).toBe('description: >-')
    const contentLines = lines.slice(2)
    expect(contentLines.length).toBeGreaterThan(0)
    for (const line of contentLines) {
      if (line.trim() === '') continue
      expect(line.startsWith('  ')).toBe(true)
    }
    expect(out).toContain('Note: both')
  })
})