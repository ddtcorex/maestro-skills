import { escapeHtml as e } from './html.mjs'
import { mdTable } from './markdown.mjs'

const SKIP = 'Skipped: no data'
const ICON = { ok: ['icon-ok', 'OK'], warn: ['icon-warn', '!'], fail: ['icon-fail', 'X'], skip: ['icon-skip', '-'] }
const BADGE = { ok: 'badge-green', warn: 'badge-yellow', fail: 'badge-red', skip: 'badge-gray' }

// Section titles in template order; report.md uses the same list so both
// files always carry identical headings.
export const PERF_SECTIONS = [
  'Verdict',
  'URLs Audited',
  'Before/After Comparison Matrix',
  'Infrastructure',
  'Cache Status',
  'Cache Invalidation Efficiency',
  'Client-Side AJAX Load',
  'Indexer Configuration',
  'Database',
  'Per-Page Query Detail',
  'Top Repeated Query Shapes',
  'Top Timers',
  'Core Web Vitals',
  'Recommendations',
  'Coverage Note',
]

export const PERF_CLIENT_SECTIONS = ['Verdict', 'Before/After Comparison Matrix', 'Top Recommendations', 'Coverage Note']

export const MATRIX_COLUMNS = [
  ['queries', 'Queries', (v) => String(v)],
  ['profilerRoot', 'Profiler root', (v) => `${v}s`],
  ['ttfbUncachedMs', 'TTFB (uncached)', (v) => `${v} ms`],
  ['score', 'Score', (v) => String(v)],
  ['lcpMs', 'LCP', (v) => `${v} ms`],
  ['cls', 'CLS', (v) => String(v)],
  ['ttfbWarmMs', 'TTFB (warm)', (v) => `${v} ms`],
  ['hit', 'HIT proof', (v) => String(v)],
]

const pageLink = (page, audience) => (audience === 'client' ? page.uri : page.url)

// A side is either measured values or {skipped: reason}; a metric that is a
// string carries its own closed reason.
function sideValue(side, key, format) {
  if (!side) return 'Skipped: no data'
  if (side.skipped) return side.skipped
  const v = side[key]
  if (v === null || v === undefined) return 'Skipped: no data'
  return typeof v === 'string' ? v : format(v)
}

function matrixCells(row) {
  return MATRIX_COLUMNS.map(([key, , format]) => {
    const after = sideValue(row.after, key, format)
    return row.before === undefined ? after : `${sideValue(row.before, key, format)} → ${after}`
  })
}

function matrixHtml(matrix, date) {
  if (!matrix) return `<div>${e(SKIP)}</div>`
  const note = matrix.baseline
    ? `<div style="font-size:13px;margin-bottom:8px">Baseline recorded: ${e(date)} - no prior URL set exists, comparison deferred to the next audit</div>`
    : ''
  const head = `<tr><th>Page</th>${MATRIX_COLUMNS.map(([, title]) => `<th>${title}</th>`).join('')}</tr>`
  const rows = matrix.rows.map((r) => `<tr><td>${e(r.label)}</td>${matrixCells(r).map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('\n    ')
  return `${note}<table>\n    ${head}\n    ${rows}\n  </table>`
}

function matrixMd(matrix, date) {
  if (!matrix) return SKIP
  const table = mdTable(['Page', ...MATRIX_COLUMNS.map(([, t]) => t)], matrix.rows.map((r) => [r.label, ...matrixCells(r)]))
  return matrix.baseline ? `Baseline recorded: ${date} - no prior URL set exists, comparison deferred to the next audit\n\n${table}` : table
}

function cwvRows(cwv, urlSet) {
  return (urlSet ?? []).map((u) => {
    const c = cwv?.[u.label]
    if (!c) return [u.label, SKIP, '', '', '', '', '']
    if (c.skipped) return [u.label, c.skipped, '', '', '', '', '']
    const spread = typeof c.spread === 'string' ? c.spread : `score ${c.spread.score}, LCP ${c.spread.lcpMs} ms`
    return [u.label, String(c.median.score), `${c.median.lcpMs} ms`, String(c.median.cls), `${c.median.ttfbMs} ms`, spread, c.hitSource]
  })
}

function checksHtml(section) {
  const checks = section?.checks ?? []
  if (checks.length === 0) return `<div class="check"><span class="icon icon-skip">-</span><span>${e(section?.skipped ?? SKIP)}</span></div>`
  return checks
    .map((c) => {
      const [cls, glyph] = ICON[c.state] ?? ICON.skip
      return `<div class="check"><span class="icon ${cls}">${glyph}</span><span>${e(c.text)}</span></div>`
    })
    .join('\n  ')
}

function checksMd(section) {
  const checks = section?.checks ?? []
  if (checks.length === 0) return section?.skipped ?? SKIP
  return checks.map((c) => `- [${c.state}] ${c.text}`).join('\n')
}

function repeatedShapes(pages) {
  const byShape = new Map()
  for (const page of pages) {
    for (const shape of page.shapes ?? []) {
      if (shape.count <= 5) continue
      const entry = byShape.get(shape.sql) ?? { sql: shape.sql, count: 0, pages: [], time: 0 }
      entry.count += shape.count
      entry.pages.push(page.label)
      entry.time = Math.max(entry.time, shape.time ?? 0)
      byShape.set(shape.sql, entry)
    }
  }
  return [...byShape.values()].sort((a, b) => b.count - a.count)
}

function perPageDetails(pages) {
  return pages
    .map((p) => {
      const rows = (p.shapes ?? []).map((s) => `<tr><td>${s.count}</td><td><code>${e(s.sql)}</code></td></tr>`).join('')
      return `<details><summary>${e(p.label)} - ${p.totalQueries} queries, ${p.distinctShapes} shapes</summary><table><tr><th>Count</th><th>SQL (normalized)</th></tr>${rows}</table></details>`
    })
    .join('\n  ')
}

// Timers past the report threshold (>5% of the page total, or Cnt 10+).
// Pages with none still render an explicit line, never an empty card.
function timersContent(pages) {
  return pages
    .map((p) => {
      const total = p.profilerRoot ?? (p.profiler ?? []).reduce((s, t) => s + (t.time ?? 0), 0)
      const rows = (p.profiler ?? [])
        .filter((t) => t.time >= 0.05 * total || (t.count ?? 0) >= 10)
        .map((t) => `<tr><td><code>${e(t.timer)}</code></td><td>${(t.time ?? 0).toFixed(3)}</td><td>${t.avg?.toFixed(3) ?? ''}</td><td>${t.count ?? ''}</td></tr>`)
        .join('')
      const body = rows
        ? `<table><tr><th>Timer</th><th>Time (s)</th><th>Avg (s)</th><th>Cnt</th></tr>${rows}</table>`
        : 'No timer past the threshold on this page.'
      return `<details><summary>${e(p.label)}</summary>${body}</details>`
    })
    .join('\n  ')
}

function timersMd(pages) {
  const rows = []
  for (const p of pages) {
    const total = p.profilerRoot ?? (p.profiler ?? []).reduce((s, t) => s + (t.time ?? 0), 0)
    for (const t of p.profiler ?? []) {
      if (t.time >= 0.05 * total || (t.count ?? 0) >= 10) rows.push([p.label, t.timer, (t.time ?? 0).toFixed(3), t.count ?? ''])
    }
  }
  return rows.length ? mdTable(['Page', 'Timer', 'Time (s)', 'Cnt'], rows) : 'No timer past the threshold on any captured page.'
}

function section(data, name) {
  return data.sections?.[name]
}

function status(sec) {
  const state = sec?.status ?? 'skip'
  return { badge: BADGE[state] ?? BADGE.skip, text: sec?.statusText ?? (sec ? state : 'Skipped') }
}

// Returns the template slots and the markdown sections for one audit.
export function buildPerf(data, audience) {
  const meta = data.meta ?? {}
  const pages = data.pages ?? []
  const repeated = repeatedShapes(pages)
  const rec = data.recommendations ?? []
  const sec = (n) => section(data, n)
  const st = (n) => status(sec(n))

  const slots = {
    title: e(meta.title ?? 'Performance Audit'),
    date: e(meta.date ?? (data.generatedAt ?? '').slice(0, 10)),
    verdict: e(data.verdict ?? SKIP),
    host: e(audience === 'client' ? '' : meta.host),
    govard_version: e(meta.govardVersion),
    profile: e(meta.profile),
    magento_version: e(meta.magentoVersion),
    php_version: e(meta.phpVersion),
    mariadb_version: e(meta.mariadbVersion),
    redis_version: e(meta.redisVersion),
    opensearch_version: e(meta.opensearchVersion),
    fpc: e(meta.fpc),
    scope: e(data.scope),
    page_count: String(pages.length),
    urls_rows: pages
      .map((p) => `<tr><td>${e(p.label)}</td><td class="url">${e(pageLink(p, audience))}</td><td>${p.totalQueries ?? SKIP}</td></tr>`)
      .join('\n    '),
    perpage_details: perPageDetails(pages),
    perpage_badge: pages.length ? 'badge-green' : 'badge-gray',
    perpage_status: pages.length ? `${pages.length} pages` : 'Skipped',
    repeated_rows: repeated
      .map((r) => `<tr><td><code>${e(r.sql)}</code></td><td>${r.count}</td><td>${e(r.pages.join(', '))}</td><td></td><td>${(r.time * 1000).toFixed(1)}</td><td></td></tr>`)
      .join('\n    '),
    db_rows: pages
      .map((p) => `<tr><td>${e(p.label)}</td><td>${p.totalQueries}</td><td>${p.dbTime ?? ''}</td><td></td><td></td><td></td><td></td></tr>`)
      .join('\n    '),
    recommendations: (audience === 'client' ? rec.slice(0, 5) : rec).map((r) => `<li>${e(r)}</li>`).join(''),
    matrix: matrixHtml(data.matrix, meta.date ?? ''),
    cwv_rows: cwvRows(data.cwv, data.urlSet).map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('\n    '),
    db_bullets: (data.dbBullets ?? []).map((b) => `<li>${e(b)}</li>`).join('\n    '),
    rec_count: String(rec.length),
    coverage_note: e(data.coverageNote ?? SKIP),
    timers_content: timersContent(pages),
  }
  for (const name of ['infra', 'cache', 'cache_inv', 'ajax', 'timers', 'cwv']) {
    const s = st(name)
    slots[`${name}_badge`] = s.badge
    slots[`${name}_status`] = e(s.text)
  }
  for (const name of ['infra', 'cache', 'cache_inv', 'ajax', 'indexer']) slots[`${name}_checks`] = checksHtml(sec(name))
  for (const name of ['infra', 'cache', 'indexer', 'cron']) {
    slots[`${name}_verdict`] = e(sec(name)?.verdict ?? 'Skipped')
    slots[`${name}_sub`] = e(sec(name)?.sub ?? '')
  }

  if (audience === 'client') {
    const clientMd = {
      Verdict: data.verdict ?? SKIP,
      'Before/After Comparison Matrix': matrixMd(data.matrix, meta.date ?? ''),
      'Top Recommendations': rec.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n'),
      'Coverage Note': `${data.coverageNote ?? SKIP}\n\nEngineering detail: [full developer report](../report.html).`,
    }
    return { slots, title: meta.title ?? 'Performance Audit', metaLines: [`Date: ${meta.date ?? ''}`], sections: PERF_CLIENT_SECTIONS.map((t) => ({ title: t, body: clientMd[t] })) }
  }

  const mdSections = {
    Verdict: data.verdict ?? SKIP,
    'Before/After Comparison Matrix': matrixMd(data.matrix, meta.date ?? ''),
    'Core Web Vitals': mdTable(['Page', 'Score', 'LCP', 'CLS', 'TTFB (warm)', 'Spread', 'HIT proof'], cwvRows(data.cwv, data.urlSet)),
    'URLs Audited': mdTable(['Type', 'URL', 'Queries'], pages.map((p) => [p.label, pageLink(p, audience), p.totalQueries])),
    Infrastructure: checksMd(sec('infra')),
    'Cache Status': checksMd(sec('cache')),
    'Cache Invalidation Efficiency': checksMd(sec('cache_inv')),
    'Client-Side AJAX Load': checksMd(sec('ajax')),
    'Indexer Configuration': checksMd(sec('indexer')),
    Database: [mdTable(['Page', 'Queries', 'DB time (s)'], pages.map((p) => [p.label, p.totalQueries, p.dbTime ?? ''])), ...(data.dbBullets ?? []).map((b) => `- ${b}`)].join('\n'),
    'Per-Page Query Detail': pages
      .map((p) => `<details><summary>${p.label} - ${p.totalQueries} queries, ${p.distinctShapes} shapes</summary>\n\n${mdTable(['Count', 'SQL (normalized)'], (p.shapes ?? []).map((s) => [s.count, s.sql]))}\n\n</details>`)
      .join('\n\n'),
    'Top Repeated Query Shapes': mdTable(['Shape (normalized)', 'Count', 'Pages'], repeated.map((r) => [r.sql, r.count, r.pages.join(', ')])),
    'Top Timers': timersMd(pages),
    Recommendations: rec.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    'Coverage Note': data.coverageNote ?? SKIP,
  }
  const sections = PERF_SECTIONS.map((title) => ({ title, body: mdSections[title] }))
  const metaLines = [`Date: ${meta.date ?? ''} | Scope: ${data.scope ?? ''} | Report contract: see report.html`]
  return { slots, sections, title: meta.title ?? 'Performance Audit', metaLines }
}
