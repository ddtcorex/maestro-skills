// Sentence templates: every number in narrative text (verdict, KPI subtitles,
// bullets) comes from data through these functions, never typed by hand.
const round1 = (n) => Math.round(n * 10) / 10

export function percent(before, after) {
  if (!before) return 'n/a'
  const pct = round1(((after - before) / before) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export function pageDelta(before, after) {
  return `${after.label}: ${before.totalQueries} to ${after.totalQueries} uncached queries (${percent(before.totalQueries, after.totalQueries)})`
}

// Query growth per extra product between the smallest and the largest
// category sample, the clearest N+1 signal a listing page gives.
export function perExtraProductSlope(pages) {
  const categories = pages.filter((p) => typeof p.productCount === 'number').sort((a, b) => a.productCount - b.productCount)
  if (categories.length < 2) return ''
  const small = categories[0]
  const large = categories[categories.length - 1]
  if (large.productCount === small.productCount) return ''
  const slope = round1((large.totalQueries - small.totalQueries) / (large.productCount - small.productCount))
  return `about ${slope} queries per extra product (${small.label} ${small.productCount} products, ${large.label} ${large.productCount} products)`
}

function shapeTotals(pages) {
  const totals = new Map()
  for (const page of pages) for (const s of page.shapes ?? []) totals.set(s.sql, (totals.get(s.sql) ?? 0) + s.count)
  return totals
}

export function topShapeReductions(before, after, n) {
  const b = shapeTotals(before)
  const a = shapeTotals(after)
  return [...b]
    .map(([sql, count]) => ({ sql, before: count, after: a.get(sql) ?? 0 }))
    .filter((s) => s.before > s.after)
    .sort((x, y) => y.before - y.after - (x.before - x.after))
    .slice(0, n)
    .map((s) => `${s.sql}: ${s.before} to ${s.after} calls`)
}

export function totalQueries(pages) {
  return pages.reduce((sum, p) => sum + p.totalQueries, 0)
}
