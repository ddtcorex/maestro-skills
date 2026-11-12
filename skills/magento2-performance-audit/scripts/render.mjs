import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClosedReason } from './lib/status.mjs'
import { normalizeCwv } from './cwv.mjs'
import { resolvePageName } from './lib/names.mjs'

// The report engine is owned by magento2-dev-core. In the plugin the two skills
// are siblings under skills/, so the engine is reachable at ../../magento2-dev-core.
// In a Claude.ai ZIP the skill is uploaded alone, so scripts/build-claude-ai-zips.mjs
// vendors that one directory as <skill>/vendor/report; resolve either layout, and
// fail loudly instead of at the first dynamic import.
const here = dirname(fileURLToPath(import.meta.url))
const report = [
  join(here, '..', '..', 'magento2-dev-core', 'scripts', 'report'),
  join(here, '..', 'vendor', 'report'),
].find((dir) => existsSync(join(dir, 'render.mjs')))
if (report === undefined) {
  throw new Error(`render.mjs: report engine not found: expected ../../magento2-dev-core/scripts/report or ../vendor/report beside ${here}`)
}
const { renderReport } = await import(join(report, 'render.mjs'))
const { findingsVerdict } = await import(join(report, 'lib', 'findings-layout.mjs'))
const { SEVERITIES } = await import(join(report, 'lib', 'validate.mjs'))
const { pageDelta, percent, perExtraProductSlope, topShapeReductions, totalQueries, verdictDetail } = await import(join(report, 'lib', 'sentences.mjs'))

const NON_200_BEFORE = 'Skipped: non-200 on before side'
const NON_200_AFTER = 'Skipped: non-200 on after side (regression)'
const NOT_MEASURED_AFTER = 'Skipped: not measured in this run'
const NOT_MEASURED_BEFORE = 'Skipped: not measured in the previous run'
const OLDER_PROTOCOL = 'Skipped: before side measured on an older protocol, re-measure with switch'
const REPEATED = 5

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback)

function loadSide(dir) {
  return {
    audit: readJson(join(dir, 'audit-data.json'), null),
    cwv: Object.fromEntries(Object.entries(readJson(join(dir, 'cwv', 'cwv.json'), {})).map(([label, entry]) => [label, normalizeCwv(entry)])),
  }
}

// A cold or TBT value missing because the run predates those measurements
// is a closed reason, not an empty cell: the matrix validator then accepts it
// on either side.
function side(page, cwv, skippedReason, notMeasured) {
  if (!page) return { skipped: 'Skipped: no data' }
  if (page.http !== 200) return { skipped: skippedReason }
  const { cold, warm } = normalizeCwv(cwv ?? {})
  const warmValue = (key) => {
    if (!warm || Object.keys(warm).length === 0) return null
    if (warm.skipped) return warm.skipped
    if (key === 'tbtMs' && warm.median && !('tbtMs' in warm.median)) return notMeasured
    return warm.median?.[key] ?? null
  }
  const coldValue = (key) => {
    if (cold === undefined) return warm && Object.keys(warm).length > 0 ? notMeasured : null
    if (cold.skipped) return cold.skipped
    return cold[key] ?? null
  }
  return {
    queries: page.totalQueries,
    profilerRoot: page.profilerRoot,
    ttfbUncachedMs: page.ttfbUncachedMs,
    scoreCold: coldValue('score'),
    scoreWarm: warmValue('score'),
    lcpColdMs: coldValue('lcpMs'),
    lcpWarmMs: warmValue('lcpMs'),
    tbtColdMs: coldValue('tbtMs'),
    tbtWarmMs: warmValue('tbtMs'),
    cls: warmValue('cls'),
    ttfbWarmMs: warmValue('ttfbMs'),
    hit: warm?.skipped ? warm.skipped : warm?.hitSource ?? null,
  }
}

const byLabel = (pages, label) => pages.find((p) => p.label === label)

function buildMatrix(urlSet, after, before) {
  const rows = urlSet.map((u) => {
    const row = { label: u.label, after: side(byLabel(after.audit.pages, u.label), after.cwv[u.label], NON_200_AFTER, NOT_MEASURED_AFTER) }
    if (before) row.before = side(byLabel(before.audit.pages, u.label), before.cwv[u.label], NON_200_BEFORE, NOT_MEASURED_BEFORE)
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
    return `Baseline: ${totalQueries(ok).toLocaleString('en-US')} uncached queries across ${ok.length} page${ok.length === 1 ? '' : 's'}${regression}`
  }
  const comparable = after.audit.pages.filter((p) => p.http === 200 && byLabel(before.audit.pages, p.label)?.http === 200)
  const b = comparable.map((p) => byLabel(before.audit.pages, p.label))
  return `Uncached SQL queries ${totalQueries(b).toLocaleString('en-US')} to ${totalQueries(comparable).toLocaleString('en-US')} (${percent(totalQueries(b), totalQueries(comparable))}) across ${comparable.length} comparable pages${regression}`
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

// Findings name code the project can change: app/code or a third-party
// vendor package. A Magento core caller is context, not a finding.
const isProjectCode = (file) => file.startsWith('app/') || (file.startsWith('vendor/') && !file.startsWith('vendor/magento/'))

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
        if (!isProjectCode(file)) continue
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
  const naming = { pageNames: agent.clientSummary?.pageNames, configUrlSet: config.urlSet, runUrlSet: after.audit.urlSet }
  const named = (entry) => ({ ...entry, name: resolvePageName(entry.label, naming) })
  const pages = (after.audit.pages ?? []).map(named)
  const data = {
    ...after.audit,
    ...agent,
    urlSet: (after.audit.urlSet ?? []).map(named),
    pages,
    themeOverrides: config.themeOverrides ?? [],
    themeChain: config.themeChain ?? [],
    cwv: after.cwv,
    invalidation: readJson(join(runDir, 'invalidation.json'), null),
    matrix: buildMatrix(after.audit.urlSet, after, before),
    verdict: verdictText(after, before),
    verdictDetail: verdictDetail(pages.filter((p) => p.http === 200), Object.fromEntries(Object.entries(after.cwv).map(([label, entry]) => [label, entry.warm]))),
    dbBullets: dbBullets(after, before),
  }
  const findings = perfFindings(data, after, before)
  writeFileSync(join(runDir, 'findings.json'), `${JSON.stringify(findings, null, 1)}\n`)
  const outDir = audience === 'client' ? join(runDir, 'client') : runDir
  return renderReport({ layout: 'perf', audience, data, outDir })
}
