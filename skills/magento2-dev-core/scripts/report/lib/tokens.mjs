// Metric tokens for client narrative: the agent writes {queries.delta} and
// the renderer fills the measured value, so no figure in the client report is
// typed by hand. Values come from the before/after matrix only.

const LCP_TARGET_MS = 2500
const TOKEN = /\{([A-Za-z0-9_.-]+)\}/g
const TICKET = /#\d+/g

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const count = (n) => n.toLocaleString('en-US')
const seconds = (s) => `${s.toFixed(2)} s`
const lcp = (ms) => `${(ms / 1000).toFixed(1)} s`
const pct = (before, after) => {
  if (!before) return null
  const p = Math.round(((after - before) / before) * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

const measured = (side) => side && !side.skipped && isNum(side.queries)

export function isBaseline(data) {
  return !data.matrix || data.matrix.baseline !== false
}

// Labels the run measured. A quick run keeps the whole frozen url set but
// measures only its first pages; the client report speaks of those only.
function measuredLabels(data) {
  return data.pages?.length ? new Set(data.pages.map((p) => p.label)) : null
}

// Rows of {label, before?, after}; a run rendered without a matrix reads its
// pages as a baseline.
export function matrixRows(data) {
  const measured = measuredLabels(data)
  if (data.matrix?.rows) return measured ? data.matrix.rows.filter((r) => measured.has(r.label)) : data.matrix.rows
  return (data.pages ?? []).map((p) => ({
    label: p.label,
    after: p.http === undefined || p.http === 200 ? { queries: p.totalQueries, profilerRoot: p.profilerRoot } : { skipped: `Skipped: HTTP ${p.http}` },
  }))
}

export function pageName(data, label) {
  const entry = (data.urlSet ?? []).find((u) => u.label === label) ?? (data.pages ?? []).find((p) => p.label === label)
  return entry?.name ?? (label === 'home' ? 'Home page' : label)
}

const SIZE_RANK = { category_small: 1, category_medium: 2, category_large: 3 }

// The category page with the most products; quick scope has no
// category_large, and a store may have no category page at all. A url set
// without product counts falls back to the size its label names.
export function largestCategory(data) {
  const measured = measuredLabels(data)
  const categories = (data.urlSet ?? []).filter((u) => u.label.startsWith('category') && (!measured || measured.has(u.label)))
  if (categories.length === 0) return null
  const rank = (u) => [u.productCount ?? -1, SIZE_RANK[u.label] ?? 0]
  const bigger = (a, b) => rank(a)[0] > rank(b)[0] || (rank(a)[0] === rank(b)[0] && rank(a)[1] > rank(b)[1])
  return categories.reduce((best, u) => (bigger(u, best) ? u : best)).label
}

export function buildTokens(data) {
  const baseline = isBaseline(data)
  const rows = matrixRows(data)
  const tokens = new Map()
  const set = (name, value, comparisonOnly = false) => tokens.set(name, { value: value ?? null, comparisonOnly })

  const comparable = rows.filter((r) => measured(r.after) && (baseline || measured(r.before)))
  const after = comparable.reduce((s, r) => s + r.after.queries, 0)
  const before = baseline ? null : comparable.reduce((s, r) => s + r.before.queries, 0)
  set('queries.total', comparable.length ? count(after) : null)
  set('queries.before', before === null ? null : count(before), true)
  set('queries.delta', before === null ? null : pct(before, after), true)

  const largest = largestCategory(data)
  const row = rows.find((r) => r.label === largest)
  const a = row?.after && !row.after.skipped && isNum(row.after.profilerRoot) ? row.after.profilerRoot : null
  const b = !baseline && row?.before && !row.before.skipped && isNum(row.before.profilerRoot) ? row.before.profilerRoot : null
  set('serverTime.largest', a === null ? null : seconds(a))
  set('serverTime.largest.before', b === null ? null : seconds(b), true)
  set('serverTime.largest.delta', a === null || b === null ? null : pct(b, a), true)

  const lcpRows = rows.filter((r) => r.after && !r.after.skipped && isNum(r.after.lcpWarmMs))
  const worst = lcpRows.reduce((w, r) => (!w || r.after.lcpWarmMs > w.after.lcpWarmMs ? r : w), null)
  set('lcp.worst', worst ? lcp(worst.after.lcpWarmMs) : null)
  set('lcp.worst.page', worst ? pageName(data, worst.label) : null)
  set('lcp.target', lcp(LCP_TARGET_MS))

  set('pages.count', String(rows.length))
  set('pages.comparable', baseline ? null : String(comparable.length), true)
  for (const r of rows) {
    const ok = measured(r.after)
    set(`page.${r.label}.queries`, ok ? count(r.after.queries) : null)
    set(`page.${r.label}.queries.delta`, ok && !baseline && measured(r.before) ? pct(r.before.queries, r.after.queries) : null, true)
    set(`page.${r.label}.name`, pageName(data, r.label))
  }
  return tokens
}

export function fillTokens(text, tokens) {
  return String(text ?? '').replace(TOKEN, (whole, name) => tokens.get(name)?.value ?? whole)
}

function narrativeFields(summary) {
  const fields = []
  ;(summary.takeaways ?? []).forEach((t, i) => fields.push([`takeaways[${i}]`, t]))
  ;(summary.nextSteps ?? []).forEach((s, i) => {
    for (const key of ['action', 'benefit', 'scope']) if (s[key] !== undefined) fields.push([`nextSteps[${i}].${key}`, s[key]])
  })
  ;(summary.decisions ?? []).forEach((d, i) => {
    for (const key of ['title', 'question']) if (d[key] !== undefined) fields.push([`decisions[${i}].${key}`, d[key]])
  })
  return fields
}

export function narrativeErrors(summary, tokens, { baseline }) {
  const errors = []
  for (const [path, text] of narrativeFields(summary ?? {})) {
    const at = `clientSummary.${path}`
    for (const [, name] of String(text).matchAll(TOKEN)) {
      const token = tokens.get(name)
      if (!token) errors.push(`${at}: unknown token {${name}}`)
      else if (token.comparisonOnly && baseline) errors.push(`${at}: token {${name}} needs a comparison`)
      else if (token.value === null) errors.push(`${at}: token {${name}} has no value`)
    }
    if (/\d/.test(String(text).replace(TOKEN, '').replace(TICKET, ''))) errors.push(`${at}: typed digits; use a metric token`)
  }
  return errors
}
