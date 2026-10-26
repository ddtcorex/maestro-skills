import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClosedReason } from './lib/status.mjs'

const report = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'magento2-dev-core', 'scripts', 'report')
const { renderReport } = await import(join(report, 'render.mjs'))
const { findingsVerdict } = await import(join(report, 'lib', 'findings-layout.mjs'))
const { SEVERITIES } = await import(join(report, 'lib', 'validate.mjs'))
const { pageDelta, percent, perExtraProductSlope, topShapeReductions, totalQueries } = await import(join(report, 'lib', 'sentences.mjs'))

const NON_200_BEFORE = 'Skipped: non-200 on before side'
const NON_200_AFTER = 'Skipped: non-200 on after side (regression)'
const OLDER_PROTOCOL = 'Skipped: before side measured on an older protocol, re-measure with switch'
const REPEATED = 5

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback)

function loadSide(dir) {
  return {
    audit: readJson(join(dir, 'audit-data.json'), null),
    cwv: readJson(join(dir, 'cwv', 'cwv.json'), {}),
  }
}

function side(page, cwv, skippedReason) {
  if (!page) return { skipped: 'Skipped: no data' }
  if (page.http !== 200) return { skipped: skippedReason }
  const warm = (key) => (cwv?.skipped ? cwv.skipped : cwv?.median?.[key] ?? null)
  return {
    queries: page.totalQueries,
    profilerRoot: page.profilerRoot,
    ttfbUncachedMs: page.ttfbUncachedMs,
    score: warm('score'),
    lcpMs: warm('lcpMs'),
    cls: warm('cls'),
    ttfbWarmMs: warm('ttfbMs'),
    hit: cwv?.skipped ? cwv.skipped : cwv?.hitSource ?? null,
  }
}

const byLabel = (pages, label) => pages.find((p) => p.label === label)

function buildMatrix(urlSet, after, before) {
  const rows = urlSet.map((u) => {
    const row = { label: u.label, after: side(byLabel(after.audit.pages, u.label), after.cwv[u.label], NON_200_AFTER) }
    if (before) row.before = side(byLabel(before.audit.pages, u.label), before.cwv[u.label], NON_200_BEFORE)
    return row
  })
  return { baseline: !before, rows }
}

function regressions(after, before) {
  return after.audit.pages.filter((p) => p.http !== 200 && (!before || byLabel(before.audit.pages, p.label)?.http === 200))
}

function verdictText(after, before) {
  const broken = regressions(after, before)
  const regression = broken.map((p) => `; ${p.label} returns ${p.http} after the change (regression)`).join('')
  if (!before) {
    const ok = after.audit.pages.filter((p) => p.http === 200)
    return `Baseline: ${totalQueries(ok)} uncached queries across ${ok.length} pages${regression}`
  }
  const comparable = after.audit.pages.filter((p) => p.http === 200 && byLabel(before.audit.pages, p.label)?.http === 200)
  const b = comparable.map((p) => byLabel(before.audit.pages, p.label))
  return `Uncached SQL queries ${totalQueries(b)} to ${totalQueries(comparable)} (${percent(totalQueries(b), totalQueries(comparable))}) across ${comparable.length} comparable pages${regression}`
}

function dbBullets(after, before) {
  const pages = after.audit.pages.filter((p) => p.http === 200)
  const bullets = []
  if (before) {
    for (const p of pages) {
      const b = byLabel(before.audit.pages, p.label)
      if (b?.http === 200) bullets.push(pageDelta(b, p))
    }
    bullets.push(...topShapeReductions(before.audit.pages.filter((p) => p.http === 200), pages, 3))
  }
  const slope = perExtraProductSlope(pages)
  if (slope) bullets.push(slope)
  return bullets
}

const callerFile = (caller) => {
  const m = caller.match(/^(.*?):(\d+) \(/)
  return m ? { file: m[1], line: Number(m[2]) } : { file: caller, line: null }
}

// Perf findings in the shared findings schema, so code review merges them.
function perfFindings(data, after, before) {
  const findings = []
  const seen = new Set()
  for (const [label, shapes] of Object.entries(data.attribution ?? {})) {
    for (const [sql, callers] of Object.entries(shapes)) {
      for (const [caller, count] of callers) {
        if (count <= REPEATED || seen.has(`${caller}|${sql}`)) continue
        seen.add(`${caller}|${sql}`)
        const { file, line } = callerFile(caller)
        findings.push({ code: 'M2-PERF-001', rule: null, severity: 'high', file, line, message: `${sql} runs ${count} times on ${label}`, fix: 'Load the rows once (IN(?) batch) or preload them in a view model' })
      }
    }
  }
  for (const p of regressions(after, before)) {
    findings.push({ code: null, rule: 'perf-audit.non-200-regression', severity: 'high', file: p.uri, line: null, message: `${p.label} returns ${p.http} after the change`, fix: 'Fix the page error before comparing performance' })
  }
  const summary = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]))
  return { tool: 'magento2-performance-audit', scope: data.scope, target: data.meta?.title ?? 'performance audit', generatedAt: data.generatedAt, skillVersion: data.skillVersion, templateVersion: data.templateVersion, verdict: findingsVerdict(summary), summary, findings }
}

// Merges a run directory (audit-data.json, cwv, invalidation, the agent's
// sections.json) into one data file and renders it, plus findings.json.
export async function renderRun(runDir, config, { compare, audience = 'dev' } = {}) {
  const after = loadSide(runDir)
  if (!after.audit) throw new ClosedReason('render', `missing ${join(runDir, 'audit-data.json')}; run analyze first`)
  let before = null
  if (compare) {
    before = loadSide(compare)
    if (!before.audit?.templateVersion) throw new ClosedReason('render', OLDER_PROTOCOL)
  }
  const agent = readJson(join(runDir, 'sections.json'), {})
  const data = {
    ...after.audit,
    ...agent,
    themeOverrides: config.themeOverrides ?? [],
    cwv: after.cwv,
    invalidation: readJson(join(runDir, 'invalidation.json'), null),
    matrix: buildMatrix(after.audit.urlSet, after, before),
    verdict: verdictText(after, before),
    dbBullets: dbBullets(after, before),
  }
  const findings = perfFindings(data, after, before)
  writeFileSync(join(runDir, 'findings.json'), `${JSON.stringify(findings, null, 1)}\n`)
  const outDir = audience === 'client' ? join(runDir, 'client') : runDir
  return renderReport({ layout: 'perf', audience, data, outDir })
}
