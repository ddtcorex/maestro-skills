import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

export function validatePerf(data) {
  return [...evidenceErrors(data.sections), ...themeCoverageErrors(data), ...matrixErrors(data.matrix)]
}
