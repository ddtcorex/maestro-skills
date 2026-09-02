/** Names of the optional subagent tool rows that the variant enables. */
const OPTIONAL_SUBAGENT_TOOL_IDS = new Set(['tool-subagent-codex', 'tool-subagent-claude-code'])

/**
 * Remove the plain `disabled: true` line from the two optional subagent tool
 * rows of a preset agent.cordis.yml. Line-based on purpose: the file uses
 * `!!js` expressions (e.g. platform gates) that a YAML parser would reject.
 * The `!!js platform` gate lines are never matched because they are not the
 * exact `disabled: true` token.
 */
export function stripOptionalSubagentDisabled(yml: string): string {
  const lines = yml.split('\n')
  const out: string[] = []
  let currentToolId: string | undefined
  for (const line of lines) {
    const idMatch = line.match(/^\s+- id: (tool-subagent-[a-z-]+)/)
    if (idMatch) currentToolId = idMatch[1]
    const isOptionalRow = currentToolId !== undefined && OPTIONAL_SUBAGENT_TOOL_IDS.has(currentToolId)
    if (isOptionalRow && /^\s+disabled: true\s*$/.test(line)) {
      currentToolId = undefined // consume the stripped row id so no later line reuses it
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

const SUBAGENT_PRESET_NAME = 'Maestro Skills + Subagents (Codex + Claude)'
const SUBAGENT_PRESET_DESCRIPTION =
  'AI Agent preset from maestro-skills with the subagent_codex and subagent_claude_code delegation tools '
  + 'enabled (both @deepseek-ai/dsh-subagent-codex and @deepseek-ai/dsh-subagent-claude-code must be installed '
  + 'in the Profile for the tool rows to register). Bundles the maestro-skills library - Govard environment '
  + 'orchestration and web frameworks (Magento 2, Laravel, Symfony, WordPress, generic PHP) plus the superpowers '
  + 'process-skills workflow (brainstorming, TDD, systematic debugging, subagent-driven development). Note: both '
  + 'providers authenticate via ChatGPT/Claude subscription - child runs fail with quota errors when the '
  + 'subscription session limit is hit.'

/** Rewrite preset.yml name/description for the subagents-enabled variant. */
export function subagentPresetYml(base: string): string {
  return base
    .replace(/^name: .*$/m, `name: ${SUBAGENT_PRESET_NAME}`)
    .replace(/^description: .*$/m, `description: ${SUBAGENT_PRESET_DESCRIPTION}`)
}