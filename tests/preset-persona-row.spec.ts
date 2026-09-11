import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESET_PATH = join(fileURLToPath(new URL('..', import.meta.url)), '.dsh-plugin', 'agent.cordis.yml')

/**
 * The YAML block starting at the `- id: <id>` row and ending before the next row
 * at the same indentation, so a row nested in a group resolves on its own.
 */
function rowBlock(yml: string, id: string): string {
  const lines = yml.split('\n')
  const start = lines.findIndex(l => l.trimStart() === `- id: ${id}`)
  expect(start, `row ${id} present`).toBeGreaterThan(-1)
  const indent = lines[start].length - lines[start].trimStart().length
  const block: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trimStart().startsWith('- id: ') && line.length - line.trimStart().length <= indent) break
    block.push(line)
  }
  return block.join('\n')
}

describe('preset persona row', () => {
  const yml = readFileSync(PRESET_PATH, 'utf8')
  const block = rowBlock(yml, 'persona')

  // `@deepseek-ai/dsh-persona` renamed its config field `text` to `prefix` and
  // added `suffix`; a row still naming `text` fails schema validation at mount
  // and takes the whole preset with it.
  it('declares prefix and no text key', () => {
    expect(block).toMatch(/^\s+prefix: /m)
    expect(block).not.toMatch(/^\s+text:/m)
  })

  it('carries a non-empty prefix', () => {
    const header = block.split('\n').find(l => /^\s+prefix: /.test(l))?.replace(/^\s+prefix:\s*/, '').trim()
    // A block-scalar header (`>-`, `|`) carries its content on the lines below.
    if (header === undefined || /^[|>]/.test(header)) {
      expect(block).toMatch(/^\s+prefix: [|>]/m)
      expect(block.split('\n').filter(l => /^\s{6,}\S/.test(l)).length).toBeGreaterThan(0)
      return
    }
    expect(header.length).toBeGreaterThan(0)
  })

  // An omitted suffix is not neutral: `dsh-persona` always registers
  // `deployment:persona-suffix`, so an empty one shadows the deployment's
  // working-directory line away for every session on this preset.
  it('restates the deployment working-directory suffix', () => {
    expect(block).toMatch(/^\s+suffix: Your working directory is \{\{cwd\}\}\.$/m)
  })
})

describe('preset parity with the shipped standard preset', () => {
  const yml = readFileSync(PRESET_PATH, 'utf8')

  it('registers the /goal command into the preset scope', () => {
    expect(rowBlock(yml, 'command-goal')).toMatch(/^\s+name: '@deepseek-ai\/dsh-command-goal'$/m)
  })

  it('registers the present tool', () => {
    expect(rowBlock(yml, 'present')).toMatch(/^\s+name: '@deepseek-ai\/dsh-tool-present'$/m)
  })

  it('lets a delegating session choose the child model', () => {
    const block = rowBlock(yml, 'tool-subagent')
    expect(block).toMatch(/^\s+toolName: subagent$/m)
    expect(block).toMatch(/modelSelectionSettings: true/)
  })
})
