import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PRESET_PATH = join(ROOT, '.dsh-plugin-creator', 'agent.cordis.yml')
const META_PATH = join(ROOT, '.dsh-plugin-creator', 'preset.yml')

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

describe('maestro-creator preset metadata', () => {
  const meta = readFileSync(META_PATH, 'utf8')

  it('names the Creator-derived preset', () => {
    expect(meta).toMatch(/^name: .*Creator/m)
  })

  it('emits a metadata doc DSH can parse (folded block survives colons+spaces)', () => {
    const lines = meta.split('\n')
    expect(lines[1]).toBe('description: >-')
    const contentLines = lines.slice(2)
    expect(contentLines.length).toBeGreaterThan(0)
    for (const line of contentLines) {
      if (line.trim() === '') continue
      expect(line.startsWith('  ')).toBe(true)
    }
  })

  it('advertises both the Creator tooling and the subagent delegation', () => {
    expect(meta).toContain('subagent_codex')
    expect(meta).toContain('subagent_claude_code')
  })
})

describe('maestro-creator preset rows from the Creator base', () => {
  const yml = readFileSync(PRESET_PATH, 'utf8')

  // The Creator base carries the Cordis authoring rows the Maestro base
  // template deliberately omits; the new preset keeps all of them.
  it('registers the cordis dynamic-definition tool', () => {
    expect(rowBlock(yml, 'tool-cordis')).toMatch(/^\s+name: '@deepseek-ai\/dsh-tool-cordis'$/m)
  })

  it('registers the plugin-manager tools behind the profileContext gate', () => {
    const block = rowBlock(yml, 'tool-plugin-manager')
    expect(block).toMatch(/^\s+name: '@deepseek-ai\/dsh-plugin-manager\/tools'$/m)
    expect(block).toMatch(/profileContext/)
  })

  it('points skill-filesystem at the bundled preset-authoring skills', () => {
    const block = rowBlock(yml, 'skill-filesystem')
    expect(block).toMatch(/^\s+name: '@deepseek-ai\/dsh-skill-filesystem'$/m)
    expect(block).toMatch(/customSkillDirs:/)
  })

  it('enables direct URL fetch on the web tool like the Creator base', () => {
    expect(rowBlock(yml, 'tool-web')).toMatch(/^\s+fetch: true$/m)
  })
})

describe('maestro-creator preset rows from the subagents variant', () => {
  const yml = readFileSync(PRESET_PATH, 'utf8')

  // Persona stays Maestro: the preset is Creator tooling with the Maestro
  // agent identity, not the upstream coding-agent persona.
  it('keeps the Maestro persona and no {{model}} reference', () => {
    const block = rowBlock(yml, 'persona')
    expect(block).toMatch(/^\s+prefix: [|>]/m)
    expect(block).toMatch(/Senior AI Agent Engineer/)
    expect(block).not.toMatch(/\{\{model\}\}/)
    expect(block).not.toMatch(/^\s+text:/m)
  })

  it('enables the codex delegation row the Creator base disables', () => {
    const block = rowBlock(yml, 'tool-subagent-codex')
    expect(block).toMatch(/provider: codex/)
    expect(block).not.toMatch(/^\s+disabled: true$/m)
  })

  it('enables the claude-code delegation row the Creator base disables', () => {
    const block = rowBlock(yml, 'tool-subagent-claude-code')
    expect(block).toMatch(/provider: claude-code/)
    expect(block).not.toMatch(/^\s+disabled: true$/m)
  })

  it('enables ralph like the subagents variant', () => {
    const block = rowBlock(yml, 'tool-ralph')
    expect(block).toMatch(/^\s+name: '@deepseek-ai\/dsh-tool-ralph'$/m)
    expect(block).not.toMatch(/^\s+disabled: true$/m)
  })

  it('keeps the present tool and the /goal command', () => {
    expect(rowBlock(yml, 'present')).toMatch(/^\s+name: '@deepseek-ai\/dsh-tool-present'$/m)
    expect(rowBlock(yml, 'command-goal')).toMatch(/^\s+name: '@deepseek-ai\/dsh-command-goal'$/m)
  })
})
