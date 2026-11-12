import { escapeHtml as e } from './html.mjs'
import { mdTable } from './markdown.mjs'
import { longDate, pageMix, pageSubtitleFor, stackLine } from './pages.mjs'
import { buildTokens, fillTokens, isBaseline, largestCategory, matrixRows, pageName } from './tokens.mjs'

// Client summary: the same six sections for a baseline and a comparison; a
// comparison adds before values and deltas. Every figure comes from a token.
export const PERF_CLIENT_SECTIONS = ['Key figures', 'In short', 'Next steps and decisions', 'Results by page', 'How to read these results', 'Glossary']

const LCP_TARGET_MS = 2500
const GAIN = -5
const REGRESSION = 5
const PRIORITY_TAG = { blocker: ['red', 'Blocker'], high: ['yellow', 'High'], medium: ['gray', 'Medium'], low: ['gray', 'Low'] }

const HOW_TO_READ = {
  comparison: [
    ['When the gain shows', 'Whenever the server has to build a page: after a catalogue or price update, after a cache flush, and on less visited pages such as filters and sorting. The server also keeps more headroom during traffic peaks.'],
    ['Why PageSpeed scores may not move', 'They mostly measure work done in the browser on pages already served from the cache, where the server answers fast. A stable score is expected, not a failure.'],
    ['Test conditions', 'A copy of the site in a test environment, with the same data and diagnostic tools switched on. Absolute times there are higher than in production, so compare the percentage change, not the times.'],
  ],
  baseline: [
    ['When these figures matter', 'Whenever the server has to build a page: after a catalogue or price update, after a cache flush and on less visited pages such as filters and sorting. Fewer requests also leave the server more headroom during traffic peaks.'],
    ['What was measured', 'Each page was loaded once right after the page cache was emptied (cold) and several times from the cache (warm). Cold shows the work the server does after a catalogue update or a cache flush; warm is what most visitors get.'],
    ['Test conditions', 'A copy of the site in a test environment, with the same data and diagnostic tools switched on. Absolute times there are higher than in production: the next report will compare request counts on these same {pages.count} pages.'],
  ],
}

const GLOSSARY = [
  ['Database request', 'a question the site asks its database to build a page (products, prices, stock).'],
  ['Page cache', 'a ready-made copy of a page, served instantly to the next visitors.'],
  ['Cold and warm', 'cold is the first load after the page cache was emptied; warm is a load served from the cache.'],
  ['Main content display (LCP)', 'the time needed to display the main element of a page, often an image. Google target: 2.5 s at most.'],
  ['Current version', null],
  ['Core Web Vitals', "Google's browsing experience metrics, used among its search ranking signals."],
  ['Repeated per-product requests (N+1)', 'the same question asked once per product displayed instead of once for the whole list.'],
]
const GLOSSARY_COMPARISON = ['Before and after', 'the two versions of the site compared, measured on the same pages and the same data.']

const HEADINGS = {
  baseline: ['Website performance audit', ''],
  comparison: ['Performance comparison of the two versions', 'Previous version compared with this version, on the same pages and data'],
}

const tokenValue = (tokens, name) => tokens.get(name)?.value ?? null
const NOT_MEASURED = 'Not measured'

// Skip reasons are written for developers; the client reads what happened.
function clientSkip(reason, side) {
  if (/non-200|HTTP \d/.test(reason ?? '')) return side === 'before' ? 'Page error on the previous version' : 'Page error on this version, fix required'
  return NOT_MEASURED
}
const deltaNumber = (text) => (text === null ? null : Number(text.replace('%', '')))

function deltaStatus(text) {
  const n = deltaNumber(text)
  if (n === null) return ['gray', 'No data']
  if (n <= GAIN) return ['green', 'Gain confirmed']
  if (n >= REGRESSION) return ['red', 'Regression']
  return ['gray', 'No change']
}

function statusTile(steps, baseline) {
  const blockers = steps.filter((s) => s.priority === 'blocker').length
  const high = steps.filter((s) => s.priority === 'blocker' || s.priority === 'high').length
  if (baseline) {
    const value = `${high} high-priority action${high === 1 ? '' : 's'}`
    return { label: 'Status', value, sub: 'ranked in the next steps below', status: high > 0 ? 'yellow' : 'green', statusText: high > 0 ? 'To address' : 'Good' }
  }
  if (blockers > 0) return { label: 'Status', value: `Release: ${blockers} fix${blockers === 1 ? '' : 'es'} required`, sub: 'before going live', status: 'red', statusText: 'Blocker' }
  return { label: 'Status', value: 'Release: ready', sub: 'no blocking issue found', status: 'green', statusText: 'Ready' }
}

export function clientTiles(data, tokens) {
  const baseline = isBaseline(data)
  const steps = data.clientSummary?.nextSteps ?? []
  const t = (name) => tokenValue(tokens, name)
  const tiles = [statusTile(steps, baseline)]

  if (baseline) tiles.push({ label: 'Database requests', value: t('queries.total') ?? NOT_MEASURED, sub: `across ${t('pages.count')} pages, nothing cached`, status: 'gray', statusText: 'Baseline' })
  else {
    const [status, statusText] = deltaStatus(t('queries.delta'))
    // A release where no page loads on both versions has no delta to show.
    if (t('queries.delta') === null) tiles.push({ label: 'Database requests', value: NOT_MEASURED, sub: 'no page measured on both versions', status, statusText })
    else tiles.push({ label: 'Database requests', value: t('queries.delta'), sub: `${t('queries.before')} → ${t('queries.total')} across ${t('pages.comparable')} comparable pages`, status, statusText })
  }

  const largest = largestCategory(data)
  const name = largest ? pageName(data, largest) : null
  if (!largest || t('serverTime.largest') === null) {
    tiles.push({ label: 'Server time, largest category', value: largest ? NOT_MEASURED : 'No category page tested', sub: name ?? '', status: 'gray', statusText: 'No data' })
  } else if (baseline || t('serverTime.largest.delta') === null) {
    tiles.push({ label: 'Server time, largest category', value: t('serverTime.largest'), sub: name, status: 'gray', statusText: 'Baseline' })
  } else {
    const [status, statusText] = deltaStatus(t('serverTime.largest.delta'))
    tiles.push({ label: 'Server time, largest category', value: t('serverTime.largest.delta'), sub: `${t('serverTime.largest.before')} → ${t('serverTime.largest')}, ${name}`, status, statusText })
  }

  tiles.push(productTile(matrixRows(data), baseline, t('lcp.target')))
  return tiles
}

const lcpOf = (side) => (side && !side.skipped && typeof side.lcpWarmMs === 'number' ? side.lcpWarmMs : null)

// "2.9 to 3.1 s", or one value when the pages agree to a tenth. Rounded on
// whole tenths, since 3050 ms / 1000 is 3.0499... and toFixed would say 3.0.
const tenths = (ms) => (Math.round(ms / 100) / 10).toFixed(1)
function lcpRange(values) {
  const lo = tenths(Math.min(...values))
  const hi = tenths(Math.max(...values))
  return lo === hi ? `${hi} s` : `${lo} to ${hi} s`
}

// Product pages carry the main content a shopper waits for, so the tile
// shows their warm LCP range rather than the slowest page of any kind.
function productTile(rows, baseline, target) {
  const label = 'Product page main content'
  const products = rows.filter((r) => r.label.startsWith('product') && lcpOf(r.after) !== null)
  if (products.length === 0) return { label, value: NOT_MEASURED, sub: `no product page measured · Google target ${target}`, status: 'gray', statusText: 'No data' }
  const after = products.map((r) => lcpOf(r.after))
  const before = baseline ? [] : products.map((r) => lcpOf(r.before)).filter((v) => v !== null)
  const pages = `${products.length} product page${products.length === 1 ? '' : 's'}, from the cache`
  const was = before.length === products.length ? `, before ${lcpRange(before)}` : ''
  const good = Math.max(...after) <= LCP_TARGET_MS
  return { label, value: lcpRange(after), sub: `${pages}${was} · Google target ${target}`, status: good ? 'green' : 'yellow', statusText: good ? 'Good' : 'To address' }
}

function tilesHtml(tiles) {
  return tiles
    .map((tile, i) => {
      const verdict = i === 0 ? ' data-report-verdict' : ''
      return `<div class="tile"><div class="tile-label">${e(tile.label)}</div><div class="tile-value"${verdict}>${e(tile.value)}</div><div class="tile-sub">${e(tile.sub)}</div><span class="tag tag-${tile.status}">${e(tile.statusText)}</span></div>`
    })
    .join('\n  ')
}

// Results by page as a plain table with CSS bars (no script, no SVG), so
// long page names wrap, the PDF never splits a drawing and a phone reads it.
const num = (n) => n.toLocaleString('en-US')

function pageCell(r) {
  return `<td class="pname"><b>${e(r.name)}</b>${r.sub ? `<span>${e(r.sub)}</span>` : ''}</td>`
}

export function resultsTable(rows, { baseline, totalDelta }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.before ?? 0, r.after ?? 0]))
  const bar = (side, v) => `<div class="bar bar-${side}" style="width:${Math.round((v / max) * 1000) / 10}%"></div>`
  const measured = rows.filter((r) => !r.skipped)
  const sum = (key) => measured.reduce((s, r) => s + r[key], 0)
  const total = `Total, ${measured.length} page${measured.length === 1 ? '' : 's'}`
  if (baseline) {
    const body = rows
      .map((r) => (r.skipped ? `<tr>${pageCell(r)}<td colspan="2" class="skip">${e(r.skipped)}</td></tr>` : `<tr>${pageCell(r)}<td class="barcell">${bar('after', r.after)}</td><td class="num">${num(r.after)}</td></tr>`))
      .join('')
    return `<table class="pages"><tr><th>Page tested</th><th>Database requests</th><th class="num">Requests</th></tr>${body}<tr class="total"><td>${total}</td><td></td><td class="num">${num(sum('after'))}</td></tr></table>`
  }
  const body = rows
    .map((r) =>
      r.skipped
        ? `<tr>${pageCell(r)}<td colspan="4" class="skip">${e(r.skipped)}</td></tr>`
        : `<tr>${pageCell(r)}<td class="barcell">${bar('before', r.before)}${bar('after', r.after)}</td><td class="num">${num(r.before)}</td><td class="num">${num(r.after)}</td><td class="num">${e(r.delta ?? '')}</td></tr>`,
    )
    .join('')
  return `<table class="pages cmp"><tr><th>Page tested</th><th>Database requests</th><th class="num">Before</th><th class="num">After</th><th class="num">Change</th></tr>${body}<tr class="total"><td>${total}</td><td class="barcell"></td><td class="num">${num(sum('before'))}</td><td class="num">${num(sum('after'))}</td><td class="num">${e(totalDelta ?? '')}</td></tr></table>`
}

function chartRows(data, tokens) {
  const baseline = isBaseline(data)
  return matrixRows(data).map((r) => {
    const name = pageName(data, r.label)
    const sub = pageSubtitleFor(data, r.label)
    if (!r.after || r.after.skipped || typeof r.after.queries !== 'number') return { name, sub, skipped: clientSkip(r.after?.skipped, 'after') }
    if (baseline) return { name, sub, after: r.after.queries }
    if (!r.before || r.before.skipped || typeof r.before.queries !== 'number') return { name, sub, skipped: clientSkip(r.before?.skipped, 'before') }
    return { name, sub, before: r.before.queries, after: r.after.queries, delta: tokenValue(tokens, `page.${r.label}.queries.delta`) }
  })
}

function stepView(step, i, tokens) {
  return {
    n: i + 1,
    priority: PRIORITY_TAG[step.priority] ?? ['gray', step.priority],
    action: fillTokens(step.action, tokens),
    benefit: fillTokens(step.benefit, tokens),
    scope: fillTokens(step.scope ?? '', tokens),
    decision: step.decision !== undefined,
  }
}

function resultsMd(chart, baseline, totalDelta) {
  const measured = chart.filter((r) => !r.skipped)
  const total = `Total, ${measured.length} page${measured.length === 1 ? '' : 's'}`
  const sum = (key) => num(measured.reduce((s, r) => s + r[key], 0))
  if (baseline) return mdTable(['Page', 'Database requests'], [...chart.map((r) => [r.name, r.skipped ?? num(r.after)]), [total, sum('after')]])
  return mdTable(['Page', 'Before', 'After', 'Change'], [...chart.map((r) => (r.skipped ? [r.name, r.skipped, '', ''] : [r.name, num(r.before), num(r.after), r.delta ?? ''])), [total, sum('before'), sum('after'), totalDelta ?? '']])
}

export function buildPerfClient(data) {
  const meta = data.meta ?? {}
  const summary = data.clientSummary ?? {}
  const baseline = isBaseline(data)
  const tokens = buildTokens(data)
  const fill = (text) => fillTokens(text, tokens)
  const tiles = clientTiles(data, tokens)
  const steps = (summary.nextSteps ?? []).map((s, i) => stepView(s, i, tokens))
  const owner = summary.owner ?? 'To estimate'
  const decisions = (summary.decisions ?? []).map((d) => ({ title: fill(d.title), question: fill(d.question) }))
  const takeaways = (summary.takeaways ?? []).map(fill)
  const chart = chartRows(data, tokens)
  const read = HOW_TO_READ[baseline ? 'baseline' : 'comparison'].map(([title, text]) => [title, fill(text)])
  const branch = meta.branch ?? data.revision?.branch
  const current = `the code running on the site today${branch ? ` (${branch} branch)` : ''}, measured before the next release.`
  const glossary = (baseline ? GLOSSARY.map(([term, text]) => [term, text ?? current]) : [...GLOSSARY.filter(([, text]) => text !== null), GLOSSARY_COMPARISON])
  const pages = tokenValue(tokens, 'pages.count')
  const mix = pageMix(matrixRows(data).map((r) => r.label))
  const scopeLine = `${pages} key pages tested (${mix})${baseline ? '' : ' · previous and current version'} · test copy of the site, same data`
  const measuredOn = longDate(meta.date ?? (data.generatedAt ?? '').slice(0, 10))
  const heading = HEADINGS[baseline ? 'baseline' : 'comparison']

  const stepRow = (s) => {
    const decision = s.decision ? ' <span class="tag tag-gray">Your decision</span>' : ''
    return `<tr><td>${s.n}</td><td><span class="tag tag-${s.priority[0]}">${e(s.priority[1])}</span></td><td>${e(s.action)}${decision}</td><td>${e(s.benefit)}</td><td>${e(s.scope)}</td><td>${e(owner)}</td></tr>`
  }
  const slots = {
    title: e(meta.title ?? 'Performance Audit'),
    date: e(meta.date ?? (data.generatedAt ?? '').slice(0, 10)),
    eyebrow: 'Performance report',
    header_side: `${meta.client ? `<b>${e(meta.client)}</b> · ` : ''}${e(stackLine(data))}<br>Measured on ${e(measuredOn)}`,
    heading: e(meta.heading ?? heading[0]),
    subtitle: (meta.subtitle ?? heading[1]) ? `<div class="subtitle">${e(meta.subtitle ?? heading[1])}</div>` : '',
    scope_line: e(scopeLine),
    tiles: tilesHtml(tiles),
    takeaways: takeaways.map((t) => `<li>${e(t)}</li>`).join('\n    '),
    next_steps_rows: steps.map(stepRow).join('\n    '),
    decisions: decisions.length
      ? `<h3>Your decisions</h3><ul class="bullets">${decisions.map((d) => `<li><b>${e(d.title)}.</b> ${e(d.question)}</li>`).join('')}</ul>`
      : '',
    chart_legend: baseline
      ? ''
      : '<div class="legend"><span><span class="swatch" style="background:var(--chart-before)"></span>Before</span><span><span class="swatch" style="background:var(--chart-after)"></span>After</span></div>',
    chart: resultsTable(chart, { baseline, totalDelta: tokenValue(tokens, 'queries.delta') }),
    how_to_read: read.map(([title, text]) => `<h3>${e(title)}</h3><p>${e(text)}</p>`).join('\n  '),
    glossary: glossary.map(([term, text]) => `<li><b>${e(term)}:</b> ${e(text)}</li>`).join('\n    '),
  }

  const md = {
    'Key figures': mdTable(['Figure', 'Value', 'Detail', 'Status'], tiles.map((t) => [t.label, t.value, t.sub, t.statusText])),
    'In short': takeaways.map((t) => `- ${t}`).join('\n'),
    'Next steps and decisions': [
      mdTable(
        ['#', 'Priority', 'Action', 'What it brings you', 'Scope', 'Owner · estimate'],
        steps.map((s) => [s.n, s.priority[1], s.decision ? `${s.action} (Your decision)` : s.action, s.benefit, s.scope, owner]),
      ),
      ...(decisions.length ? ['', '### Your decisions', '', ...decisions.map((d) => `- ${d.title}: ${d.question}`)] : []),
    ].join('\n'),
    'Results by page': resultsMd(chart, baseline, tokenValue(tokens, 'queries.delta')),
    'How to read these results': read.map(([title, text]) => `**${title}.** ${text}`).join('\n\n'),
    Glossary: glossary.map(([term, text]) => `- **${term}:** ${text}`).join('\n'),
  }
  return {
    slots,
    title: meta.title ?? 'Performance Audit',
    metaLines: [`Measured on ${measuredOn}`, scopeLine],
    sections: PERF_CLIENT_SECTIONS.map((title) => ({ title, body: md[title] })),
  }
}
