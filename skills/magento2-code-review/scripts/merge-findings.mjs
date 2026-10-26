#!/usr/bin/env node
// Merges the findings.json files of the QA trio (and the performance audit)
// into one code review findings.json. Usage:
//   merge-findings.mjs --out findings.json <input.json>...
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lib = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'magento2-dev-core', 'scripts', 'report', 'lib')
const { SEVERITIES, validateFindings } = await import(join(lib, 'validate.mjs'))
const { findingsVerdict } = await import(join(lib, 'findings-layout.mjs'))

const rank = (severity) => SEVERITIES.indexOf(severity)

// Same code (or rule) at the same file and line is one finding; the highest
// severity any input gave it wins.
export function mergeFindings(files) {
  const inputs = files.map((f) => JSON.parse(readFileSync(f, 'utf-8')))
  const merged = new Map()
  for (const input of inputs) {
    for (const finding of input.findings) {
      const key = `${finding.code ?? finding.rule}|${finding.file}|${finding.line ?? ''}`
      const existing = merged.get(key)
      if (!existing || rank(finding.severity) < rank(existing.severity)) merged.set(key, finding)
    }
  }
  const findings = [...merged.values()].sort((a, b) => rank(a.severity) - rank(b.severity))
  const summary = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]))
  return {
    tool: 'magento2-code-review',
    scope: inputs[0]?.scope ?? 'project',
    target: [...new Set(inputs.map((i) => i.target))].join(', '),
    generatedAt: new Date().toISOString(),
    skillVersion: inputs[0]?.skillVersion ?? null,
    templateVersion: inputs[0]?.templateVersion ?? 1,
    verdict: findingsVerdict(summary),
    summary,
    findings,
    coverageNote: `Merged from ${inputs.map((i) => i.tool).join(', ')}`,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const outAt = args.indexOf('--out')
  const out = outAt === -1 ? null : args[outAt + 1]
  const files = args.filter((_, i) => i !== outAt && i !== outAt + 1)
  if (!out || files.length === 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, stage: 'merge', reason: 'usage: merge-findings.mjs --out findings.json <input.json>...' })}\n`)
    process.exit(2)
  }
  const merged = mergeFindings(files)
  const errors = validateFindings(merged)
  if (errors.length > 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, stage: 'merge', reason: errors.join('; ') })}\n`)
    process.exit(1)
  }
  writeFileSync(out, `${JSON.stringify(merged, null, 1)}\n`)
  process.stdout.write(`${JSON.stringify({ ok: true, stage: 'merge', outputs: [out] })}\n`)
}
