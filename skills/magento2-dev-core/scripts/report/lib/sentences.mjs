// Sentence templates: every number in narrative text (verdict, KPI subtitles,
// bullets) comes from data through these functions, never typed by hand.
const round1 = (n) => Math.round(n * 10) / 10

export function percent(before, after) {
  if (!before) return 'n/a'
  const pct = round1(((after - before) / before) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export function pageDelta(before, after) {
  return `${after.label}: ${before.totalQueries.toLocaleString('en-US')} to ${after.totalQueries.toLocaleString('en-US')} uncached queries (${percent(before.totalQueries, after.totalQueries)})`
}

// Query growth per extra product between the smallest and the largest
// category sample, the clearest N+1 signal a listing page gives. The
// listed count (what the page renders) wins over the configured catalogue
// count, which ignores disabled products and pagination.
export function perExtraProductSlope(pages) {
  const listed = pages.filter((p) => p.label?.startsWith('category') && typeof p.totalQueries === 'number')
  if (listed.length >= 2 && listed.every((p) => typeof p.listedCount === 'number')) {
    const sorted = [...listed].sort((a, b) => a.listedCount - b.listedCount)
    const small = sorted[0]
    const large = sorted[sorted.length - 1]
    if (large.listedCount === small.listedCount) return ''
    const slope = round1((large.totalQueries - small.totalQueries) / (large.listedCount - small.listedCount))
    const of = (p) => (p.listingTotal > p.listedCount ? ` of ${p.listingTotal}` : '')
    return `about ${slope} queries per extra listed product (${small.label} ${small.listedCount} listed${of(small)}, ${large.label} ${large.listedCount} listed${of(large)})`
  }
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
    // Identifier backticks are dropped so the whole shape stays one code span.
    .map((s) => `${s.before.toLocaleString('en-US')} to ${s.after.toLocaleString('en-US')} calls: \`${s.sql.replace(/`/g, '')}\``)
}

export function totalQueries(pages) {
  return pages.reduce((sum, p) => sum + p.totalQueries, 0)
}

const grouped = (n) => n.toLocaleString('en-US')
const tenths = (ms) => (Math.round(ms / 100) / 10).toFixed(1)

// Verdict detail: one sentence per signal the run carries, each skipped when
// its data is missing, so a quick run reads as its headline alone.
// pages: measured pages with names; warm: {label: normalized warm entry}.
export function verdictDetail(pages, warm) {
  const out = []
  const categories = pages.filter((p) => p.label.startsWith('category'))
  const listed = categories.filter((p) => typeof p.listedCount === 'number').sort((a, b) => a.listedCount - b.listedCount)
  if (listed.length >= 2 && listed.length === categories.length) {
    const slope = (listed.at(-1).totalQueries - listed[0].totalQueries) / (listed.at(-1).listedCount - listed[0].listedCount)
    if (Number.isFinite(slope)) {
      out.push(`Category listings scale with listed products: ${listed.map((p) => grouped(p.totalQueries)).join(' → ')} queries for ${listed.map((p) => p.listedCount).join(' / ')} listed products (about ${round1(slope)} queries per extra listed product).`)
    }
  }
  const size = (p) => p.listedCount ?? p.productCount ?? -1
  const largest = categories.filter((p) => typeof p.profilerRoot === 'number').reduce((best, p) => (!best || size(p) > size(best) ? p : best), null)
  if (largest) out.push(`${largest.name ?? largest.label} builds in ${largest.profilerRoot.toFixed(2)} s of profiler root time uncached.`)
  const timed = pages.filter((p) => typeof p.maxTime === 'number' && p.maxTime > 0)
  if (timed.length) {
    const slowestMs = Math.max(...timed.map((p) => p.maxTime)) * 1000
    const slow = timed.reduce((s, p) => s + (p.ge50ms ?? 0), 0)
    out.push(slow === 0 ? `No query over ${Math.ceil(slowestMs)} ms: the cost is query count, not slow queries.` : `${slow} quer${slow === 1 ? 'y takes' : 'ies take'} 50 ms or more (slowest ${Math.round(slowestMs)} ms).`)
  }
  const measured = pages.filter((p) => warm[p.label] && !warm[p.label].skipped && warm[p.label].median)
  if (measured.length) {
    const hits = measured.filter((p) => warm[p.label].hitSource && warm[p.label].hitSource !== 'none').length
    const where = hits === pages.length ? 'on every page' : `on ${hits} of ${pages.length} pages`
    const lcps = measured.filter((p) => p.label.startsWith('product')).map((p) => warm[p.label].median.lcpMs).filter((v) => typeof v === 'number')
    const range = lcps.length ? `; product pages keep a warm LCP of ${tenths(Math.min(...lcps)) === tenths(Math.max(...lcps)) ? tenths(Math.max(...lcps)) : `${tenths(Math.min(...lcps))} to ${tenths(Math.max(...lcps))}`} s` : ''
    out.push(`Warm loads are served from the page cache ${where} (HIT proven)${range}.`)
  }
  return out
}
