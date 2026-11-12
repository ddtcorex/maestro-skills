import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeRecommendations } from './perf-layout.mjs'
import { buildTokens, isBaseline, matrixRows, narrativeErrors } from './tokens.mjs'

export const SEVERITIES = ['critical', 'high', 'medium', 'low']

const codesFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'references', 'severity-and-codes.md')
let knownCodes

// Codes come from severity-and-codes.md; this file never invents new ones.
export function knownFindingCodes() {
  knownCodes ??= new Set(readFileSync(codesFile, 'utf-8').match(/M2-[A-Z]+-\d{3}/g) ?? [])
  return knownCodes
}

export function validateFindings(data) {
  const errors = []
  const findings = Array.isArray(data?.findings) ? data.findings : null
  if (!findings) return ['findings: must be an array']
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]))
  findings.forEach((f, i) => {
    const at = `findings[${i}]`
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}.severity: "${f.severity}" is not one of ${SEVERITIES.join(', ')}`)
    else counts[f.severity]++
    if (f.code === null || f.code === undefined) {
      if (!f.rule) errors.push(`${at}.rule: required when code is null`)
    } else if (!/^M2-[A-Z]+-\d{3}$/.test(f.code)) {
      errors.push(`${at}.code: "${f.code}" is not an M2 code; use null with rule for unmapped tool output`)
    } else if (!knownFindingCodes().has(f.code)) {
      errors.push(`${at}.code: ${f.code} is not defined in severity-and-codes.md`)
    }
    if (!f.file) errors.push(`${at}.file: required`)
    if (!f.message) errors.push(`${at}.message: required`)
  })
  for (const s of SEVERITIES) {
    if ((data.summary?.[s] ?? -1) !== counts[s]) errors.push(`summary.${s}: ${data.summary?.[s]} but ${counts[s]} findings carry that severity`)
  }
  return errors
}

function hasNumber(value) {
  if (typeof value === 'number') return true
  if (Array.isArray(value)) return value.some(hasNumber)
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => k !== 'evidence' && hasNumber(v))
  return false
}

// Agent-written sections: any number needs the command and the raw output
// excerpt it came from, so a typed number cannot reach the report.
function evidenceErrors(sections) {
  const errors = []
  for (const [name, section] of Object.entries(sections ?? {})) {
    if (!hasNumber(section)) continue
    const ev = section.evidence
    if (!ev?.command || !ev?.excerpt) errors.push(`sections.${name}: numeric values need evidence {command, excerpt}`)
  }
  return errors
}

// Every theme overriding the listing or product template must render at
// least one sample, or the audit cannot see that theme's queries.
function themeCoverageErrors(data) {
  const templates = [...(data.urlSet ?? []), ...(data.pages ?? [])].map((p) => p.template).filter(Boolean)
  return (data.themeOverrides ?? [])
    .filter((theme) => !templates.some((t) => t.includes(`app/design/frontend/${theme}/`)))
    .map((theme) => `themeOverrides: ${theme} is rendered by no sample; add a sample page that uses it`)
}

function matrixErrors(matrix) {
  const errors = []
  for (const row of matrix?.rows ?? []) {
    if (!row.before || !row.after || row.before.skipped || row.after.skipped) continue
    for (const key of new Set([...Object.keys(row.before), ...Object.keys(row.after)])) {
      const b = row.before[key] ?? null
      const a = row.after[key] ?? null
      if ((b === null) !== (a === null)) errors.push(`matrix.${row.label}.${key}: recorded on one side only`)
    }
  }
  return errors
}

// Ids a report link can target: lowercase ASCII words joined by hyphens,
// never a section id or a page block prefix of the report, never a name
// claude.ai keeps for itself.
const ID_RULE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const RESERVED_IDS = ['settings', 'sidebar', 'customize', 'upgrade', 'downloads']
const SECTION_IDS = ['verdict', 'urls-audited', 'comparison-matrix', 'infrastructure', 'cache-status', 'cache-invalidation', 'ajax-load', 'indexer', 'database', 'slow-queries', 'per-page-queries', 'repeated-shapes', 'timers', 'core-web-vitals', 'code-patterns', 'recommendations', 'coverage', 'key-figures', 'in-short', 'next-steps', 'results', 'how-to-read', 'glossary']

function recommendationIdErrors(data) {
  return (data.recommendations ?? [])
    .filter((r) => typeof r === 'object' && r !== null)
    .map((r) => r.id)
    .filter((id) => typeof id !== 'string' || !ID_RULE.test(id) || RESERVED_IDS.includes(id) || SECTION_IDS.includes(id) || /^(comment|page|queries|timers)-/.test(id))
    .map((id) => `recommendations: id "${id}" must be lowercase words joined by hyphens and not a reserved or section name`)
}

export const PRIORITIES = ['blocker', 'high', 'medium', 'low']

// The client report is built from the agent's clientSummary; a missing or
// inconsistent summary is an error, never a fallback to developer content.
function clientErrors(data) {
  const summary = data.clientSummary
  if (!summary) return ['clientSummary: required for the client report']
  const errors = []
  const takeaways = summary.takeaways ?? []
  if (takeaways.length < 3 || takeaways.length > 6) errors.push(`clientSummary.takeaways: 3 to 6 items, found ${takeaways.length}`)
  const steps = summary.nextSteps ?? []
  if (steps.length === 0) errors.push('clientSummary.nextSteps: at least one step')
  steps.forEach((s, i) => {
    if (!PRIORITIES.includes(s.priority)) errors.push(`clientSummary.nextSteps[${i}].priority: "${s.priority}" is not one of ${PRIORITIES.join(', ')}`)
  })
  const rank = steps.map((s) => PRIORITIES.indexOf(s.priority))
  if (rank.some((r, i) => i > 0 && r < rank[i - 1])) errors.push(`clientSummary.nextSteps: sort by priority ${PRIORITIES.join(', ')}`)
  let recIds = new Set()
  try {
    recIds = new Set(normalizeRecommendations(data.recommendations).map((r) => r.id))
  } catch (err) {
    errors.push(err.message)
  }
  const decisionIds = new Set((summary.decisions ?? []).map((d) => d.id))
  steps.forEach((s, i) => {
    if (s.decision !== undefined && !decisionIds.has(s.decision)) errors.push(`clientSummary.nextSteps[${i}].decision: unknown decision ${s.decision}`)
    for (const ref of s.refs ?? []) if (!recIds.has(ref)) errors.push(`clientSummary.nextSteps[${i}].refs: unknown recommendation ${ref}`)
  })
  // A page that breaks after the change blocks the release; the status tile
  // must not read "Release: ready" over it.
  if (!isBaseline(data) && !steps.some((s) => s.priority === 'blocker')) {
    for (const row of matrixRows(data)) {
      if (row.after?.skipped?.includes('(regression)')) errors.push(`clientSummary.nextSteps: ${row.label} fails after the change; add a blocker step`)
    }
  }
  return [...errors, ...narrativeErrors(summary, buildTokens(data), { baseline: isBaseline(data) })]
}

export function validatePerf(data, audience = 'dev') {
  const errors = [...evidenceErrors(data.sections), ...themeCoverageErrors(data), ...matrixErrors(data.matrix), ...recommendationIdErrors(data)]
  return audience === 'client' ? [...errors, ...clientErrors(data)] : errors
}
