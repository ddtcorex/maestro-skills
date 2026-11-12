import { escapeHtml as e } from './html.mjs'
import { mdTable } from './markdown.mjs'
import { longDate, pageSubtitleFor, stackLine } from './pages.mjs'
import { isBaseline, pageName } from './tokens.mjs'

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
  'Slow Queries',
  'Per-Page Query Detail',
  'Top Repeated Query Shapes',
  'Top Timers',
  'Core Web Vitals',
  'Code-Level Performance Patterns',
  'Recommendations',
  'Coverage Note',
]

const ms = (v) => `${v} ms`
const grouped = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? ''))
// Every table sits in a scroll container, so a wide table scrolls inside
// its card instead of pushing the page wider on a phone.
const tw = (table) => `<div class="tw">${table}</div>`
const TOP_SHAPES = 15
// Fragment-safe id for a url set label: category_large reads category-large.
const slug = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// Escaped text with `paired backticks` as inline code, so a class or method
// name never breaks across lines at its arrow; a lone backtick stays literal.
const withCode = (text) => e(text).replace(/`([^`]+)`/g, '<code>$1</code>')

// Every timing column names its state: cold is the first load after the page
// cache was cleaned, warm the median of the runs served from it.
export const MATRIX_COLUMNS = [
  ['queries', 'Queries', (v) => v.toLocaleString('en-US')],
  ['profilerRoot', 'Profiler root', (v) => `${v.toFixed(2)} s`],
  ['ttfbUncachedMs', 'TTFB (uncached)', ms],
  ['scoreCold', 'Score cold', (v) => String(v)],
  ['scoreWarm', 'Score warm', (v) => String(v)],
  ['lcpColdMs', 'LCP cold', ms],
  ['lcpWarmMs', 'LCP warm', ms],
  ['tbtColdMs', 'TBT cold', ms],
  ['tbtWarmMs', 'TBT warm', ms],
  ['cls', 'CLS (warm)', (v) => String(v)],
  ['ttfbWarmMs', 'TTFB (warm)', ms],
  ['hit', 'HIT proof (warm)', (v) => String(v)],
]

export const CWV_COLUMNS = ['Page', 'Score warm', 'LCP cold', 'LCP warm', 'TBT cold', 'TBT warm', 'CLS (warm)', 'TTFB (warm)', 'Spread (warm)', 'HIT proof (warm)']

// Recommendations are plain strings or {id, text}. A string gets the
// positional id rec-N; the client report points at ids, so reordering never
// retargets a reference.
export function normalizeRecommendations(rec) {
  const seen = new Set()
  return (rec ?? []).map((r, i) => {
    const item = typeof r === 'string' ? { id: `rec-${i + 1}`, text: r } : { id: r.id, text: r.text }
    if (seen.has(item.id)) throw new Error(`recommendations: duplicate id ${item.id}`)
    seen.add(item.id)
    return { ...item, n: i + 1 }
  })
}

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
  return `${note}${tw(`<table class="matrix">\n    ${head}\n    ${rows}\n  </table>`)}`
}

function matrixMd(matrix, date) {
  if (!matrix) return SKIP
  const table = mdTable(['Page', ...MATRIX_COLUMNS.map(([, t]) => t)], matrix.rows.map((r) => [r.label, ...matrixCells(r)]))
  return matrix.baseline ? `Baseline recorded: ${date} - no prior URL set exists, comparison deferred to the next audit\n\n${table}` : table
}

// cwv entries are {cold, warm}; a cold value missing from an older run reads
// as not measured instead of an empty cell.
function cwvRows(cwv, urlSet) {
  return (urlSet ?? []).map((u) => {
    const entry = cwv?.[u.label]
    const warm = entry?.warm
    const cold = entry?.cold
    if (!entry) return [u.label, SKIP, SKIP, '', SKIP, '', '', '', '', '']
    const coldCell = (key) => (cold === undefined ? 'Skipped: not measured in this run' : cold.skipped ?? (cold[key] === null || cold[key] === undefined ? SKIP : `${cold[key]} ms`))
    if (!warm || Object.keys(warm).length === 0) return [u.label, SKIP, coldCell('lcpMs'), '', coldCell('tbtMs'), '', '', '', '', '']
    if (warm.skipped) return [u.label, warm.skipped, coldCell('lcpMs'), '', coldCell('tbtMs'), '', '', '', '', '']
    const spread = typeof warm.spread === 'string' ? warm.spread : `score ${warm.spread.score}, LCP ${warm.spread.lcpMs} ms`
    const tbtWarm = 'tbtMs' in warm.median ? `${warm.median.tbtMs} ms` : 'Skipped: not measured in this run'
    return [u.label, String(warm.median.score), coldCell('lcpMs'), `${warm.median.lcpMs} ms`, coldCell('tbtMs'), tbtWarm, String(warm.median.cls), `${warm.median.ttfbMs} ms`, spread, warm.hitSource]
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

// "all 7 pages", "all except home", else the labels themselves.
function pagesCell(labels, all) {
  const missing = all.filter((l) => !labels.includes(l))
  if (missing.length === 0 && all.length > 1) return `all ${all.length} pages`
  if (all.length > 3 && missing.length <= 2) return `all except ${missing.join(' and ')}`
  return labels.join(', ')
}

function repeatedTable(repeated, all) {
  const head = '<tr><th>Shape (normalized)</th><th>Count</th><th>Pages</th><th>Max time on one page</th></tr>'
  const row = (r) => `<tr><td><code>${e(r.sql)}</code></td><td class="n">${grouped(r.count)}</td><td>${e(pagesCell(r.pages, all))}</td><td class="n">${(r.time * 1000).toFixed(1)} ms</td></tr>`
  const top = tw(`<table class="repeated">${head}${repeated.slice(0, TOP_SHAPES).map(row).join('')}</table>`)
  const rest = repeated.slice(TOP_SHAPES)
  if (rest.length === 0) return top
  return `${top}<details class="more"><summary>${rest.length} more repeated shapes (${grouped(rest[0].count)} or fewer each)</summary>${tw(`<table class="repeated">${head}${rest.map(row).join('')}</table>`)}</details>`
}

const named = (data, p) => {
  const name = p.name ?? pageName(data, p.label)
  return name === p.label ? p.label : `${name} (${p.label})`
}

function perPageDetails(data, pages) {
  return pages
    .map((p) => {
      const rows = (p.shapes ?? []).map((s) => `<tr><td class="n">${s.count}</td><td><code>${e(s.sql)}</code></td></tr>`).join('')
      return `<details id="queries-${slug(p.label)}"><summary>${e(named(data, p))} - ${grouped(p.totalQueries)} queries, ${p.distinctShapes} shapes</summary>${tw(`<table><tr><th class="count-col">Count</th><th>SQL (normalized)</th></tr>${rows}</table>`)}</details>`
    })
    .join('\n  ')
}

const dbCells = (p) => {
  const avg = p.totalQueries && typeof p.dbTime === 'number' ? `${((p.dbTime / p.totalQueries) * 1000).toFixed(2)} ms` : ''
  return [grouped(p.totalQueries), typeof p.dbTime === 'number' ? `${p.dbTime.toFixed(2)} s` : '', typeof p.maxTime === 'number' ? `${(p.maxTime * 1000).toFixed(1)} ms` : '', avg, p.ge1s ?? '', p.ge50ms ?? '', p.ge10ms ?? '']
}

// Timers past the report threshold (>5% of the page total, or Cnt 10+).
// Pages with none still render an explicit line, never an empty card.
function timersContent(pages) {
  return pages
    .map((p) => {
      const total = p.profilerRoot ?? (p.profiler ?? []).reduce((s, t) => s + (t.time ?? 0), 0)
      const rows = (p.profiler ?? [])
        .filter((t) => t.time >= 0.05 * total || (t.count ?? 0) >= 10)
        .map((t) => `<tr><td><code>${e(t.timer)}</code></td><td class="n">${(t.time ?? 0).toFixed(3)}</td><td class="n">${t.avg?.toFixed(3) ?? ''}</td><td class="n">${t.count ?? ''}</td></tr>`)
        .join('')
      const body = rows
        ? tw(`<table><tr><th>Timer</th><th>Time (s)</th><th>Avg (s)</th><th>Cnt</th></tr>${rows}</table>`)
        : 'No timer past the threshold on this page.'
      return `<details id="timers-${slug(p.label)}"><summary>${e(p.label)}</summary>${body}</details>`
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

// "Current version (main @ abc1234) · baseline measured 2026-10-28"; the
// agent's meta revision wins over the one capture recorded.
function techSubtitle(data, date) {
  const branch = data.meta?.branch ?? data.revision?.branch
  const commit = data.meta?.commit ?? data.revision?.commit
  const rev = branch && commit ? ` (${branch} @ ${commit})` : branch || commit ? ` (${branch ?? commit})` : ''
  return isBaseline(data) ? `Current version${rev} · baseline measured ${date}` : `Previous version compared with the current version${rev} · measured ${date}`
}

// Returns the template slots and the markdown sections for one audit.
export function buildPerf(data, audience) {
  const meta = data.meta ?? {}
  const pages = data.pages ?? []
  const repeated = repeatedShapes(pages)
  const rec = normalizeRecommendations(data.recommendations)
  const sec = (n) => section(data, n)
  const st = (n) => status(sec(n))

  const date = meta.date ?? (data.generatedAt ?? '').slice(0, 10)
  const slots = {
    title: e(meta.title ?? 'Performance Audit'),
    date: e(date),
    verdict: e(data.verdict ?? SKIP),
    verdict_detail: data.verdictDetail?.length ? `<p>${e(data.verdictDetail.join(' '))}</p>` : '',
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
    eyebrow: 'Technical report',
    header_side: `${meta.client ? `<b>${e(meta.client)}</b> · ` : ''}${e(stackLine(data))}<br>Measured on ${e(longDate(date))}`,
    subtitle: e(techSubtitle(data, date)),
    urls_rows: pages
      .map((p) => `<tr id="page-${slug(p.label)}"><td>${e(p.label)}</td><td>${e(p.name ?? pageName(data, p.label))}<span class="sub">${e(pageSubtitleFor(data, p.label))}</span></td><td class="url">${e(pageLink(p, audience))}</td><td>${typeof p.totalQueries === 'number' ? grouped(p.totalQueries) : SKIP}</td></tr>`)
      .join('\n    '),
    perpage_details: perPageDetails(data, pages),
    perpage_badge: pages.length ? 'badge-green' : 'badge-gray',
    perpage_status: pages.length ? `${pages.length} pages` : 'Skipped',
    repeated_table: repeatedTable(repeated, pages.map((p) => p.label)),
    db_rows: pages
      .map((p) => `<tr><td>${e(p.label)}</td>${dbCells(p).map((c) => `<td class="n">${e(c)}</td>`).join('')}</tr>`)
      .join('\n    '),
    recommendations: (audience === 'client' ? rec.slice(0, 5) : rec).map((r) => `<li id="${e(r.id)}"><b>Rec. ${r.n}:</b> ${withCode(r.text)}</li>`).join(''),
    matrix: matrixHtml(data.matrix, meta.date ?? ''),
    cwv_rows: cwvRows(data.cwv, data.urlSet).map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('\n    '),
    db_bullets: (data.dbBullets ?? []).map((b) => `<li>${withCode(b)}</li>`).join('\n    '),
    rec_count: String(rec.length),
    coverage_note: e(data.coverageNote ?? SKIP),
    timers_content: timersContent(pages),
  }
  for (const name of ['infra', 'cache', 'cache_inv', 'ajax', 'timers', 'cwv', 'slow_queries', 'code_patterns']) {
    const s = st(name)
    slots[`${name}_badge`] = s.badge
    slots[`${name}_status`] = e(s.text)
  }
  for (const name of ['infra', 'cache', 'cache_inv', 'ajax', 'indexer', 'slow_queries', 'code_patterns']) slots[`${name}_checks`] = checksHtml(sec(name))
  for (const name of ['infra', 'cache', 'indexer', 'cron', 'slow_queries', 'code_patterns']) {
    slots[`${name}_verdict`] = e(sec(name)?.verdict ?? 'Skipped')
    slots[`${name}_sub`] = e(sec(name)?.sub ?? '')
  }

  const mdSections = {
    Verdict: [data.verdict ?? SKIP, ...(data.verdictDetail?.length ? [data.verdictDetail.join(' ')] : [])].join('\n\n'),
    'Before/After Comparison Matrix': matrixMd(data.matrix, meta.date ?? ''),
    'Top Timers': timersMd(pages),
    'Core Web Vitals': mdTable(CWV_COLUMNS, cwvRows(data.cwv, data.urlSet)),
    'Code-Level Performance Patterns': checksMd(sec('code_patterns')),
    'URLs Audited': mdTable(['Type', 'Page', 'URL', 'Queries'], pages.map((p) => [p.label, p.name ?? p.label, pageLink(p, audience), p.totalQueries])),
    Infrastructure: checksMd(sec('infra')),
    'Cache Status': checksMd(sec('cache')),
    'Cache Invalidation Efficiency': checksMd(sec('cache_inv')),
    'Client-Side AJAX Load': checksMd(sec('ajax')),
    'Indexer Configuration': checksMd(sec('indexer')),
    Database: [mdTable(['Page', 'Queries', 'DB time', 'Slowest', 'Average', '≥ 1 s', '≥ 50 ms', '≥ 10 ms'], pages.map((p) => [p.label, ...dbCells(p)])), ...(data.dbBullets ?? []).map((b) => `- ${b}`)].join('\n'),
    'Slow Queries': checksMd(sec('slow_queries')),
    'Per-Page Query Detail': pages
      .map((p) => `<details><summary>${p.label} - ${p.totalQueries} queries, ${p.distinctShapes} shapes</summary>\n\n${mdTable(['Count', 'SQL (normalized)'], (p.shapes ?? []).map((s) => [s.count, s.sql]))}\n\n</details>`)
      .join('\n\n'),
    'Top Repeated Query Shapes': mdTable(['Shape (normalized)', 'Count', 'Pages', 'Max time on one page'], repeated.map((r) => [r.sql, r.count, pagesCell(r.pages, pages.map((p) => p.label)), `${(r.time * 1000).toFixed(1)} ms`])),
    'Top Timers': timersMd(pages),
    Recommendations: rec.map((r) => `Rec. ${r.n}. ${r.text}`).join('\n'),
    'Coverage Note': data.coverageNote ?? SKIP,
  }
  const sections = PERF_SECTIONS.map((title) => ({ title, body: mdSections[title] }))
  const metaLines = [`Date: ${meta.date ?? ''} | Scope: ${data.scope ?? ''} | Report contract: see report.html`]
  return { slots, sections, title: meta.title ?? 'Performance Audit', metaLines }
}
