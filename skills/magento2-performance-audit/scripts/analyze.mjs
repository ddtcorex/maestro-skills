import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attributeCaller } from './lib/attribution.mjs'
import { parseProfiler, templatePath } from './lib/profiler.mjs'
import { normalizeSql, parseQueryLog } from './lib/querylog.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const TEMPLATE_VERSION = 1
// Shapes called at least this often on a traced page get caller attribution.
const ATTRIBUTION_MIN = 2

export function skillVersion() {
  return JSON.parse(readFileSync(join(here, '..', '..', '..', 'package.json'), 'utf-8')).version
}

function readSummary(captureDir) {
  const [header, ...lines] = readFileSync(join(captureDir, 'summary.csv'), 'utf-8').trim().split('\n')
  const keys = header.split(',')
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])))
}

const templatePattern = (label) =>
  label.startsWith('category') ? /\/templates\/product\/list\.phtml$/ : label.startsWith('product') ? /\/templates\/product\/view\.phtml$/ : null

function analyzePage(captureDir, row, rows, config) {
  const records = parseQueryLog(readFileSync(join(captureDir, 'pass1', `${row.label}.db.log`), 'utf-8'))
  const shapes = new Map()
  for (const r of records) {
    const sql = normalizeSql(r.sql)
    const s = shapes.get(sql) ?? { sql, count: 0, time: 0 }
    s.count++
    s.time += r.time
    shapes.set(sql, s)
  }
  const htmlFile = join(captureDir, 'pass1', `${row.label}.html`)
  const profiler = existsSync(htmlFile) ? parseProfiler(readFileSync(htmlFile, 'utf-8')) : []
  const pattern = templatePattern(row.label)
  const other = (pass) => rows.find((r) => r.pass === pass && r.label === row.label)
  const times = records.map((r) => r.time)
  return {
    label: row.label,
    url: `${config.baseUrl}${row.uri}`,
    uri: row.uri,
    http: Number(row.http),
    totalQueries: records.length,
    pass2Queries: other('pass2') ? Number(other('pass2').queries) : null,
    traceQueries: other('trace') ? Number(other('trace').queries) : null,
    distinctShapes: shapes.size,
    dbTime: round(times.reduce((a, b) => a + b, 0)),
    maxTime: times.length ? Math.max(...times) : 0,
    ge1s: times.filter((t) => t >= 1).length,
    ge50ms: times.filter((t) => t >= 0.05).length,
    ge10ms: times.filter((t) => t >= 0.01).length,
    profilerRoot: profiler.find((p) => p.timer === 'magento')?.time ?? null,
    ttfbUncachedMs: Math.round(Number(row.ttfb) * 1000),
    template: pattern ? templatePath(profiler, pattern) : null,
    shapes: [...shapes.values()].sort((a, b) => b.count - a.count).map((s) => ({ ...s, time: round(s.time) })),
    slowest: records.map((r) => ({ sql: normalizeSql(r.sql), time: r.time })).sort((a, b) => b.time - a.time).slice(0, 5),
    profiler: profiler.filter((p) => p.time >= 0.05).sort((a, b) => b.time - a.time).slice(0, 20),
  }
}

const round = (n) => Math.round(n * 10000) / 10000

function attribution(captureDir, rows) {
  const out = {}
  for (const row of rows.filter((r) => r.pass === 'trace')) {
    const perShape = new Map()
    for (const r of parseQueryLog(readFileSync(join(captureDir, 'trace', `${row.label}.db.log`), 'utf-8'))) {
      const sql = normalizeSql(r.sql)
      const callers = perShape.get(sql) ?? new Map()
      const { caller } = attributeCaller(r.trace)
      callers.set(caller, (callers.get(caller) ?? 0) + 1)
      perShape.set(sql, callers)
    }
    out[row.label] = Object.fromEntries(
      [...perShape].filter(([, c]) => [...c.values()].reduce((a, b) => a + b, 0) >= ATTRIBUTION_MIN).map(([sql, c]) => [sql, [...c].sort((a, b) => b[1] - a[1]).slice(0, 4)]),
    )
  }
  return out
}

// Reads <runDir>/capture and writes <runDir>/audit-data.json.
export function analyzeRun(runDir, config, { scope = 'deep' } = {}) {
  const captureDir = join(runDir, 'capture')
  const rows = readSummary(captureDir)
  const pages = rows.filter((r) => r.pass === 'pass1').map((row) => analyzePage(captureDir, row, rows, config))
  const byLabel = new Map(pages.map((p) => [p.label, p]))
  const data = {
    scope,
    generatedAt: new Date().toISOString(),
    templateVersion: TEMPLATE_VERSION,
    skillVersion: skillVersion(),
    urlSet: config.urlSet.map((u) => ({ label: u.label, url: `${config.baseUrl}${u.uri}`, uri: u.uri, template: byLabel.get(u.label)?.template ?? null })),
    pages,
    attribution: attribution(captureDir, rows),
    passMismatch: pages.filter((p) => p.pass2Queries !== null && p.pass2Queries !== p.totalQueries).map((p) => p.label),
  }
  writeFileSync(join(runDir, 'audit-data.json'), `${JSON.stringify(data, null, 1)}\n`)
  return data
}
