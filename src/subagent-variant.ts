/**
 * Derivation of the `maestro-skills-subagents` preset variant from the base
 * `.dsh-plugin/` template.
 *
 * These are NOT called at runtime. DSH reads presets from
 * `@deepseek-ai/dsh-agent-preset` declaration rows; `$DSH_HOME/.agent-presets/`
 * is read by nothing (upstream: "Before declaration rows, a user preset was a
 * directory … Nothing reads that directory any more"). This plugin used to
 * materialize the base and the variant into that directory on every boot,
 * which wrote files no roster could see and logged a success that changed
 * nothing.
 *
 * They stay as the executable definition of how the variant is derived: the
 * shipped `preset-maestro-skills-subagents` row is regenerated from
 * `.dsh-plugin/agent.cordis.yml` through these two transforms, and the tests
 * pin that transformation. `preset-persona-row.spec.ts` guards the base
 * template both read.
 */

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
  // The description contains colons followed by a space (e.g. "Note: both"),
  // which a YAML plain scalar cannot hold — emit it as a folded block scalar.
  // The template's preset.yml is only {name, description}: rebuild those two
  // lines and preserve any trailing content after them verbatim.
  const trailing = base.split('\n').slice(2).join('\n')
  return `name: ${SUBAGENT_PRESET_NAME}\ndescription: >-\n  ${SUBAGENT_PRESET_DESCRIPTION}\n${trailing}`
}