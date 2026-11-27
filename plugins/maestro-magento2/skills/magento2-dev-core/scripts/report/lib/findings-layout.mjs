import { escapeHtml as e } from './html.mjs'
import { mdTable } from './markdown.mjs'
import { SEVERITIES } from './validate.mjs'

const BADGE = { critical: 'badge-red', high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' }

export const FINDINGS_SECTIONS = ['Verdict', 'Summary', 'Findings', 'Coverage Note']

// Sentence template over the counts, for example "2 high, 1 medium findings; no critical".
export function findingsVerdict(summary) {
  const parts = SEVERITIES.filter((s) => summary[s] > 0).map((s) => `${summary[s]} ${s}`)
  if (parts.length === 0) return 'No findings'
  const tail = summary.critical > 0 ? '' : '; no critical'
  return `${parts.join(', ')} findings${tail}`
}

const location = (f) => (f.line ? `${f.file}:${f.line}` : f.file)
const label = (f) => f.code ?? f.rule

export function buildFindings(data, _audience) {
  const findings = [...data.findings].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
  const verdict = findingsVerdict(data.summary)
  const title = `${data.tool} report`
  const slots = {
    title: e(title),
    date: e((data.generatedAt ?? '').slice(0, 10)),
    tool: e(data.tool),
    scope: e(data.scope),
    target: e(data.target),
    verdict: e(verdict),
    summary_rows: SEVERITIES.map((s) => `<tr><td><span class="badge ${BADGE[s]}">${s}</span></td><td>${data.summary[s]}</td></tr>`).join('\n    '),
    finding_rows: findings
      .map((f) => `<tr><td><span class="badge ${BADGE[f.severity]}">${f.severity}</span></td><td><code>${e(label(f))}</code></td><td class="url"><code>${e(location(f))}</code></td><td>${e(f.message)}</td><td>${e(f.fix ?? '')}</td></tr>`)
      .join('\n    '),
    finding_count: String(findings.length),
    coverage_note: e(data.coverageNote ?? `${data.tool} on ${data.scope} scope, target ${data.target}`),
  }
  const md = {
    Verdict: verdict,
    Summary: mdTable(['Severity', 'Count'], SEVERITIES.map((s) => [s, data.summary[s]])),
    Findings: findings.map((f) => `- **[${label(f)}]** ${f.severity}, \`${location(f)}\`, ${f.message}${f.fix ? `, fix: ${f.fix}` : ''}`).join('\n'),
    'Coverage Note': slots.coverage_note,
  }
  return {
    slots,
    title,
    metaLines: [`Tool: ${data.tool} | Scope: ${data.scope} | Target: ${data.target}`],
    sections: FINDINGS_SECTIONS.map((t) => ({ title: t, body: md[t] })),
  }
}
